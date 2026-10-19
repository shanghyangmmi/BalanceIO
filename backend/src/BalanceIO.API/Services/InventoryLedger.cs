using BalanceIO.API.Data;
using BalanceIO.API.Models;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Services;

/// <summary>
/// The one way stock changes. Every movement names a warehouse (the
/// company's default when the caller has none), and the product's
/// company-wide StockOnHand moves by the same quantity, so the warehouse
/// balances always add up to it.
///
/// Callers add the movement to the context and save it with their own
/// document, so stock, movement and journal entry commit together.
/// </summary>
public class InventoryLedger
{
    public const string DefaultCode = "MAIN";

    private readonly ApplicationDbContext _context;
    private readonly Dictionary<Guid, Warehouse> _defaults = new();

    public InventoryLedger(ApplicationDbContext context)
    {
        _context = context;
    }

    /// <summary>The company's default warehouse, created when it has none.</summary>
    public async Task<Warehouse> DefaultWarehouseAsync(Guid companyId)
    {
        if (_defaults.TryGetValue(companyId, out var cached)) return cached;

        var warehouse = _context.Warehouses.Local.FirstOrDefault(w => w.CompanyId == companyId && w.IsDefault)
            ?? await _context.Warehouses.IgnoreQueryFilters()
                .FirstOrDefaultAsync(w => w.CompanyId == companyId && w.IsDefault);

        if (warehouse is null)
        {
            warehouse = new Warehouse
            {
                Id = Guid.NewGuid(),
                CompanyId = companyId,
                Code = DefaultCode,
                Name = "Gudang Utama",
                IsDefault = true,
                IsActive = true,
            };
            // A company may already use the code for something else.
            if (await _context.Warehouses.IgnoreQueryFilters().AnyAsync(w => w.CompanyId == companyId && w.Code == DefaultCode))
                warehouse.Code = $"{DefaultCode}-{Guid.NewGuid().ToString("N")[..4].ToUpperInvariant()}";
            _context.Warehouses.Add(warehouse);
        }

        _defaults[companyId] = warehouse;
        return warehouse;
    }

    /// <summary>The named warehouse, checked against the company, or the default when none is named.</summary>
    public async Task<Guid> ResolveAsync(Guid companyId, Guid? warehouseId, bool requireActive = true)
    {
        if (!warehouseId.HasValue) return (await DefaultWarehouseAsync(companyId)).Id;

        // The default may have been created in this request and not saved yet.
        var local = _context.Warehouses.Local.FirstOrDefault(w => w.Id == warehouseId.Value && w.CompanyId == companyId);
        var warehouse = (local is not null ? new { local.IsActive } : null)
            ?? await _context.Warehouses.IgnoreQueryFilters()
                .Where(w => w.Id == warehouseId.Value && w.CompanyId == companyId)
                .Select(w => new { w.IsActive })
                .FirstOrDefaultAsync()
            ?? throw new InventoryRuleException("WAREHOUSE_NOT_FOUND", "The warehouse does not exist in this company.", StatusCodes.Status404NotFound);

        if (requireActive && !warehouse.IsActive)
            throw new InventoryRuleException("WAREHOUSE_INACTIVE", "The warehouse is inactive; stock cannot move in or out of it.");

        return warehouseId.Value;
    }

    /// <summary>
    /// Records a movement and changes the product's total by the same
    /// quantity. Positive quantities add stock, negative remove it.
    ///
    /// Value follows moving-average cost. <paramref name="totalCost"/> is the
    /// signed change in carrying value: the net purchase amount for a
    /// receipt, the original amount for a reversal. Null values the movement
    /// at the current average, which is what an issue costs. The returned
    /// movement's TotalCost is the amount to post to the inventory account.
    /// </summary>
    public async Task<InventoryMovement> MoveAsync(
        Product product, Guid? warehouseId, decimal quantity, InventoryMovementType type,
        DateOnly date, decimal? totalCost, string? reference, Guid? journalEntryId, string? notes,
        bool reversal = false)
    {
        var unit = UnitCost(product);
        var value = totalCost ?? AtAverage(product, quantity);

        var movement = new InventoryMovement
        {
            Id = Guid.NewGuid(),
            CompanyId = product.CompanyId,
            ProductId = product.Id,
            // A reversal returns stock to where it came from, even if that
            // warehouse has since been deactivated.
            WarehouseId = await ResolveAsync(product.CompanyId, warehouseId, requireActive: !reversal),
            MovementDate = date,
            Type = type,
            Quantity = quantity,
            UnitCost = quantity != 0m && value != 0m ? Math.Round(Math.Abs(value / quantity), 4, MidpointRounding.ToEven) : unit,
            TotalCost = value,
            ReferenceNumber = reference,
            JournalEntryId = journalEntryId,
            Notes = notes,
        };

        _context.InventoryMovements.Add(movement);
        product.StockOnHand += quantity;
        product.InventoryValue += value;
        if (product.StockOnHand > 0m)
            product.AverageCost = Math.Round(product.InventoryValue / product.StockOnHand, 4, MidpointRounding.ToEven);
        product.UpdatedAt = DateTime.UtcNow;
        return movement;
    }

    /// <summary>
    /// What one unit costs now: the moving average while stock is held, the
    /// last average after it runs out, the buy price before any was valued.
    /// </summary>
    public static decimal UnitCost(Product product) =>
        product.StockOnHand > 0m ? Math.Round(product.InventoryValue / product.StockOnHand, 4, MidpointRounding.ToEven)
        : product.AverageCost > 0m ? product.AverageCost
        : product.BuyPrice;

    /// <summary>
    /// Signed value of a quantity at the current average, rounded to the
    /// cent. An issue that empties the stock takes the whole carrying value,
    /// so rounding never leaves value behind on zero units.
    /// </summary>
    public static decimal AtAverage(Product product, decimal quantity)
    {
        var unit = UnitCost(product);
        if (quantity < 0m && product.StockOnHand > 0m && -quantity >= product.StockOnHand)
            return -product.InventoryValue + Math.Round((quantity + product.StockOnHand) * unit, 2, MidpointRounding.ToEven);
        return Math.Round(quantity * unit, 2, MidpointRounding.ToEven);
    }

    /// <summary>Stock of one product in one warehouse, including movements added but not yet saved.</summary>
    public async Task<decimal> QuantityAsync(Guid companyId, Guid productId, Guid warehouseId)
    {
        // Summed in memory: SQLite stores decimal(19,4) as REAL.
        var saved = (await _context.InventoryMovements.IgnoreQueryFilters().AsNoTracking()
                .Where(m => m.CompanyId == companyId && m.ProductId == productId && m.WarehouseId == warehouseId)
                .Select(m => m.Quantity)
                .ToListAsync())
            .Sum();

        var pending = _context.ChangeTracker.Entries<InventoryMovement>()
            .Where(e => e.State == EntityState.Added
                     && e.Entity.ProductId == productId && e.Entity.WarehouseId == warehouseId)
            .Sum(e => e.Entity.Quantity);

        return saved + pending;
    }

    /// <summary>
    /// Reverses every movement of the given type recorded under a document
    /// reference, into the warehouses they came from and at the value they
    /// carried. Used when the document is voided, so the reversal matches
    /// what was posted rather than what the document says now.
    /// </summary>
    public async Task ReverseAsync(Guid companyId, string reference, InventoryMovementType type, DateOnly date, string reversalReference, string notes)
    {
        var recorded = await _context.InventoryMovements.IgnoreQueryFilters()
            .Where(m => m.CompanyId == companyId && m.ReferenceNumber == reference && m.Type == type)
            .ToListAsync();

        foreach (var m in recorded)
        {
            var product = await _context.Products.IgnoreQueryFilters().FirstOrDefaultAsync(p => p.Id == m.ProductId && p.CompanyId == companyId);
            if (product is null) continue;
            await MoveAsync(product, m.WarehouseId, -m.Quantity, InventoryMovementType.ManualAdjustment, date, -m.TotalCost,
                reversalReference, null, notes, reversal: true);
        }
    }

    /// <summary>
    /// Moves stock between two warehouses: an out leg and an in leg, the
    /// company total unchanged, no value posted. The average is company-wide,
    /// so a transfer leaves it as it is. Refused when the source
    /// does not hold the quantity.
    /// </summary>
    public async Task<(InventoryMovement Out, InventoryMovement In)> TransferAsync(
        Product product, Guid fromWarehouseId, Guid toWarehouseId, decimal quantity, DateOnly date, string reference, string? notes)
    {
        if (quantity <= 0m)
            throw new InventoryRuleException("VALIDATION_FAILED", "Transfer quantity must be more than zero.");
        if (fromWarehouseId == toWarehouseId)
            throw new InventoryRuleException("VALIDATION_FAILED", "Source and destination are the same warehouse.");
        if (!product.TrackInventory)
            throw new InventoryRuleException("NOT_TRACKED", "This product does not track inventory.");

        var from = await ResolveAsync(product.CompanyId, fromWarehouseId);
        var to = await ResolveAsync(product.CompanyId, toWarehouseId);

        var available = await QuantityAsync(product.CompanyId, product.Id, from);
        if (available < quantity)
            throw new InventoryRuleException("INSUFFICIENT_STOCK",
                $"Only {available:0.####} {product.Unit} of {product.Name} is in the source warehouse.");

        var outLeg = await MoveAsync(product, from, -quantity, InventoryMovementType.Transfer, date, 0m, reference, null, notes);
        var inLeg = await MoveAsync(product, to, quantity, InventoryMovementType.Transfer, date, 0m, reference, null, notes);
        return (outLeg, inLeg);
    }
}
