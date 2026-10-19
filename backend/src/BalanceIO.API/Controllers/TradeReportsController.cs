using BalanceIO.API.Data;
using BalanceIO.API.Models;
using BalanceIO.API.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Controllers;

/// <summary>
/// Sales and purchases by party and by product, totalled in decimal from
/// posted documents (drafts, pending bills and voids excluded) dated in the
/// period. Net is the line amount before PPN, which is what the documents
/// post to revenue or to inventory and expense. Amounts are in the document
/// currency, so rows and totals are kept per currency.
/// </summary>
[ApiController]
[Route("api/Reports")]
[Authorize]
public class TradeReportsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public TradeReportsController(ApplicationDbContext context)
    {
        _context = context;
    }

    private static (DateOnly From, DateOnly To) Period(DateOnly? start, DateOnly? end)
    {
        var to = end ?? DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
        return (start ?? new DateOnly(to.Year, 1, 1), to);
    }

    private static readonly InvoiceStatus[] PostedInvoices =
        [InvoiceStatus.Sent, InvoiceStatus.PartiallyPaid, InvoiceStatus.Paid, InvoiceStatus.Overdue];

    private static readonly BillStatus[] PostedBills =
        [BillStatus.Posted, BillStatus.PartiallyPaid, BillStatus.Paid];

    private sealed record PartyDocument(Guid ContactId, string Currency, decimal Net, decimal Tax, decimal Total, decimal Paid, decimal Due);

    private async Task<Dictionary<Guid, (string Code, string Name)>> ContactsAsync(IEnumerable<Guid> ids)
    {
        var list = ids.Distinct().ToList();
        return await _context.Contacts.AsNoTracking()
            .Where(c => list.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, c => (c.Code, c.Name));
    }

    private static object ByParty(DateOnly from, DateOnly to, List<PartyDocument> documents, Dictionary<Guid, (string Code, string Name)> contacts)
    {
        var rows = documents
            .GroupBy(d => new { d.ContactId, d.Currency })
            .Select(g => new
            {
                g.Key.ContactId,
                Code = contacts.TryGetValue(g.Key.ContactId, out var c) ? c.Code : null,
                Name = contacts.TryGetValue(g.Key.ContactId, out var n) ? n.Name : "(deleted contact)",
                g.Key.Currency,
                Documents = g.Count(),
                Net = g.Sum(d => d.Net),
                Tax = g.Sum(d => d.Tax),
                Total = g.Sum(d => d.Total),
                Paid = g.Sum(d => d.Paid),
                Outstanding = g.Sum(d => d.Due),
            })
            .OrderBy(r => r.Currency).ThenByDescending(r => r.Net).ThenBy(r => r.Name)
            .ToList();

        var totals = rows.GroupBy(r => r.Currency).Select(g => new
        {
            Currency = g.Key,
            Documents = g.Sum(r => r.Documents),
            Net = g.Sum(r => r.Net),
            Tax = g.Sum(r => r.Tax),
            Total = g.Sum(r => r.Total),
            Paid = g.Sum(r => r.Paid),
            Outstanding = g.Sum(r => r.Outstanding),
        }).ToList();

        return new { Start = from, End = to, Rows = rows, Totals = totals };
    }

    // Line amounts are read and subtracted in memory: SQLite stores decimal(19,4) as REAL.
    [HttpGet("sales-by-customer")]
    [RequiresPermission(Permissions.SalesView)]
    public async Task<IActionResult> SalesByCustomer([FromQuery] DateOnly? start, [FromQuery] DateOnly? end)
    {
        var (from, to) = Period(start, end);
        var invoices = await _context.SalesInvoices.AsNoTracking()
            .Where(i => PostedInvoices.Contains(i.Status) && i.InvoiceDate >= from && i.InvoiceDate <= to)
            .Select(i => new
            {
                i.ContactId, i.Currency, i.TaxAmount, i.Total, i.AmountPaid, i.AmountDue,
                Lines = i.Lines.Select(l => new { l.LineTotal, l.TaxAmount }).ToList(),
            })
            .ToListAsync();

        var documents = invoices.Select(i => new PartyDocument(i.ContactId, i.Currency, i.Lines.Sum(l => l.LineTotal - l.TaxAmount), i.TaxAmount, i.Total, i.AmountPaid, i.AmountDue)).ToList();
        return Ok(ByParty(from, to, documents, await ContactsAsync(documents.Select(d => d.ContactId))));
    }

    [HttpGet("purchases-by-vendor")]
    [RequiresPermission(Permissions.PurchasesView)]
    public async Task<IActionResult> PurchasesByVendor([FromQuery] DateOnly? start, [FromQuery] DateOnly? end)
    {
        var (from, to) = Period(start, end);
        var bills = await _context.PurchaseBills.AsNoTracking()
            .Where(b => PostedBills.Contains(b.Status) && b.BillDate >= from && b.BillDate <= to)
            .Select(b => new
            {
                b.ContactId, b.Currency, b.TaxAmount, b.Total, b.AmountPaid, b.AmountDue,
                Lines = b.Lines.Select(l => new { l.LineTotal, l.TaxAmount }).ToList(),
            })
            .ToListAsync();

        var documents = bills.Select(b => new PartyDocument(b.ContactId, b.Currency, b.Lines.Sum(l => l.LineTotal - l.TaxAmount), b.TaxAmount, b.Total, b.AmountPaid, b.AmountDue)).ToList();
        return Ok(ByParty(from, to, documents, await ContactsAsync(documents.Select(d => d.ContactId))));
    }

    private sealed record ProductLine(Guid? ProductId, string Description, string Unit, string Currency, decimal Quantity, decimal Net, string Document);

    private async Task<List<ProductRow>> ByProductAsync(List<ProductLine> lines)
    {
        var ids = lines.Where(l => l.ProductId.HasValue).Select(l => l.ProductId!.Value).Distinct().ToList();
        var products = await _context.Products.AsNoTracking()
            .Where(p => ids.Contains(p.Id))
            .Select(p => new { p.Id, p.Code, p.Name, p.Unit })
            .ToDictionaryAsync(p => p.Id);

        // Lines without a product are grouped by their description.
        return lines
            .GroupBy(l => new { l.ProductId, Key = l.ProductId.HasValue ? "" : l.Description.Trim().ToLowerInvariant(), l.Currency })
            .Select(g =>
            {
                var p = g.Key.ProductId.HasValue && products.TryGetValue(g.Key.ProductId.Value, out var hit) ? hit : null;
                var quantity = g.Sum(l => l.Quantity);
                var net = g.Sum(l => l.Net);
                return new ProductRow(
                    g.Key.ProductId, p?.Code, p?.Name ?? g.First().Description, p?.Unit ?? g.First().Unit, g.Key.Currency,
                    g.Select(l => l.Document).Distinct().Count(), quantity, net,
                    quantity == 0m ? 0m : Math.Round(net / quantity, 4, MidpointRounding.ToEven));
            })
            .OrderBy(r => r.Currency).ThenByDescending(r => r.Net).ThenBy(r => r.Name)
            .ToList();
    }

    private sealed record ProductRow(Guid? ProductId, string? Code, string Name, string Unit, string Currency,
        int Documents, decimal Quantity, decimal Net, decimal AveragePrice);

    /// <summary>
    /// Includes cost of sales for tracked products: the value the invoices'
    /// stock movements took at moving-average cost, so gross margin agrees
    /// with what was posted to COGS.
    /// </summary>
    [HttpGet("sales-by-product")]
    [RequiresPermission(Permissions.SalesView)]
    public async Task<IActionResult> SalesByProduct([FromQuery] DateOnly? start, [FromQuery] DateOnly? end)
    {
        var (from, to) = Period(start, end);
        // Lines carry no CompanyId; the invoice's company scopes them.
        var companyId = _context.CurrentCompanyId;
        var lines = await _context.SalesInvoiceLines.AsNoTracking()
            .Where(l => l.SalesInvoice!.CompanyId == companyId && PostedInvoices.Contains(l.SalesInvoice.Status)
                     && l.SalesInvoice.InvoiceDate >= from && l.SalesInvoice.InvoiceDate <= to)
            .Select(l => new { l.ProductId, l.Description, l.Unit, l.SalesInvoice!.Currency, l.Quantity, l.LineTotal, l.TaxAmount, l.SalesInvoice.InvoiceNumber })
            .ToListAsync();

        var rows = await ByProductAsync(lines.Select(l => new ProductLine(l.ProductId, l.Description, l.Unit, l.Currency, l.Quantity, l.LineTotal - l.TaxAmount, l.InvoiceNumber)).ToList());

        var numbers = lines.Select(l => l.InvoiceNumber).Distinct().ToList();
        var issued = await _context.InventoryMovements.AsNoTracking()
            .Where(m => m.Type == InventoryMovementType.Sale && m.ReferenceNumber != null && numbers.Contains(m.ReferenceNumber))
            .Select(m => new { m.ProductId, m.TotalCost })
            .ToListAsync();
        var cost = issued.GroupBy(m => m.ProductId).ToDictionary(g => g.Key, g => -g.Sum(m => m.TotalCost));

        var withCost = rows.Select(r =>
        {
            decimal? cogs = r.ProductId.HasValue && cost.TryGetValue(r.ProductId.Value, out var c) ? c : null;
            return new
            {
                r.ProductId, r.Code, r.Name, r.Unit, r.Currency, Invoices = r.Documents, r.Quantity, r.Net, r.AveragePrice,
                CostOfSales = cogs,
                GrossProfit = cogs.HasValue ? r.Net - cogs.Value : (decimal?)null,
            };
        }).ToList();

        var totals = withCost.GroupBy(r => r.Currency).Select(g => new
        {
            Currency = g.Key,
            Net = g.Sum(r => r.Net),
            CostOfSales = g.Sum(r => r.CostOfSales ?? 0m),
            GrossProfit = g.Where(r => r.GrossProfit.HasValue).Sum(r => r.GrossProfit!.Value),
            NetWithCost = g.Where(r => r.CostOfSales.HasValue).Sum(r => r.Net),
        }).ToList();

        return Ok(new { Start = from, End = to, Rows = withCost, Totals = totals });
    }

    [HttpGet("purchases-by-product")]
    [RequiresPermission(Permissions.PurchasesView)]
    public async Task<IActionResult> PurchasesByProduct([FromQuery] DateOnly? start, [FromQuery] DateOnly? end)
    {
        var (from, to) = Period(start, end);
        var companyId = _context.CurrentCompanyId;
        var lines = await _context.PurchaseBillLines.AsNoTracking()
            .Where(l => l.PurchaseBill!.CompanyId == companyId && PostedBills.Contains(l.PurchaseBill.Status)
                     && l.PurchaseBill.BillDate >= from && l.PurchaseBill.BillDate <= to)
            .Select(l => new { l.ProductId, l.Description, l.Unit, l.PurchaseBill!.Currency, l.Quantity, l.LineTotal, l.TaxAmount, l.PurchaseBill.BillNumber })
            .ToListAsync();

        var rows = await ByProductAsync(lines.Select(l => new ProductLine(l.ProductId, l.Description, l.Unit, l.Currency, l.Quantity, l.LineTotal - l.TaxAmount, l.BillNumber)).ToList());
        var totals = rows.GroupBy(r => r.Currency).Select(g => new { Currency = g.Key, Net = g.Sum(r => r.Net) }).ToList();

        return Ok(new
        {
            Start = from, End = to,
            Rows = rows.Select(r => new { r.ProductId, r.Code, r.Name, r.Unit, r.Currency, Bills = r.Documents, r.Quantity, r.Net, AverageCost = r.AveragePrice }),
            Totals = totals,
        });
    }
}
