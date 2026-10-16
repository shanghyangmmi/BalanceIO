using BalanceIO.API.Data;
using BalanceIO.API.Models;
using BalanceIO.API.Services;
using BalanceIO.API.Security;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ContactsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public ContactsController(ApplicationDbContext context)
    {
        _context = context;
    }

    // GET: api/contacts
    [HttpGet]
    [RequiresPermission(Permissions.ContactsView)]
    public async Task<ActionResult<IEnumerable<Contact>>> GetAll(
        [FromQuery] ContactType? type = null,
        [FromQuery] bool? isCustomer = null,
        [FromQuery] bool? isVendor = null,
        [FromQuery] bool? isEmployee = null,
        [FromQuery] bool? isTaxParty = null)
    {
        var query = _context.Contacts.AsQueryable();

        if (isCustomer.HasValue)
            query = query.Where(c => c.IsCustomer == isCustomer.Value);

        if (isVendor.HasValue)
            query = query.Where(c => c.IsVendor == isVendor.Value);

        if (isEmployee.HasValue)
            query = query.Where(c => c.IsEmployee == isEmployee.Value);

        if (isTaxParty.HasValue)
            query = query.Where(c => c.IsTaxParty == isTaxParty.Value);

        if (type.HasValue && !isCustomer.HasValue && !isVendor.HasValue && !isEmployee.HasValue)
            query = query.Where(c => c.Type == type || c.Type == ContactType.Both);

        var contacts = await query
            .OrderBy(c => c.Name)
            .ToListAsync();

        return Ok(contacts);
    }

    // GET: api/contacts/{id}
    [HttpGet("{id}")]
    [RequiresPermission(Permissions.ContactsView)]
    public async Task<ActionResult<Contact>> GetById(Guid id)
    {
        var contact = await _context.Contacts
            .Include(c => c.DefaultReceivableAccount)
            .Include(c => c.DefaultPayableAccount)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (contact == null)
            return NotFound();

        return Ok(contact);
    }

    // POST: api/contacts
    [HttpPost]
    [RequiresPermission(Permissions.ContactsManage)]
    public async Task<ActionResult<Contact>> Create(Contact contact)
    {
        if (contact.Id == Guid.Empty)
            contact.Id = Guid.NewGuid();

        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        contact.CompanyId = _context.CurrentCompanyId.Value;

        // Synchronize Type enum based on additive role flags
        SyncContactType(contact);

        // Generate code if not provided
        if (string.IsNullOrEmpty(contact.Code))
        {
            contact.Code = await GenerateCode(contact);
        }

        contact.CreatedAt = DateTime.UtcNow;

        _context.Contacts.Add(contact);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = contact.Id }, contact);
    }

    // PUT: api/contacts/{id}
    [HttpPut("{id}")]
    [RequiresPermission(Permissions.ContactsManage)]
    public async Task<IActionResult> Update(Guid id, Contact contact)
    {
        if (id != contact.Id)
            return BadRequest("ID mismatch");

        var existing = await _context.Contacts.FindAsync(id);
        if (existing == null)
            return NotFound();

        // Synchronize Type enum based on additive role flags
        SyncContactType(contact);

        // Update fields
        existing.Name = contact.Name;
        existing.DisplayName = contact.DisplayName;
        existing.Type = contact.Type;
        existing.Category = contact.Category;
        existing.Scope = contact.Scope;
        existing.Email = contact.Email;
        existing.Phone = contact.Phone;
        existing.Mobile = contact.Mobile;
        existing.Address = contact.Address;
        existing.City = contact.City;
        existing.PostalCode = contact.PostalCode;
        existing.Country = contact.Country;
        existing.TaxId = contact.TaxId;
        existing.TaxName = contact.TaxName;
        existing.CreditLimit = contact.CreditLimit;
        existing.PaymentTermDays = contact.PaymentTermDays;
        existing.DefaultCurrency = contact.DefaultCurrency;
        existing.DefaultReceivableAccountId = contact.DefaultReceivableAccountId;
        existing.DefaultPayableAccountId = contact.DefaultPayableAccountId;

        // Update Additive Roles & Attributes
        existing.IsCustomer = contact.IsCustomer;
        existing.IsVendor = contact.IsVendor;
        existing.IsEmployee = contact.IsEmployee;
        existing.IsTaxParty = contact.IsTaxParty;

        existing.Nik = contact.Nik;
        existing.PtkpStatus = contact.PtkpStatus;
        existing.BpjsKetenagakerjaanNumber = contact.BpjsKetenagakerjaanNumber;
        existing.BpjsKesehatanNumber = contact.BpjsKesehatanNumber;
        existing.BankName = contact.BankName;
        existing.BankAccountNumber = contact.BankAccountNumber;
        existing.BankAccountHolder = contact.BankAccountHolder;

        existing.WithholdingType = contact.WithholdingType;
        existing.WithholdingRate = contact.WithholdingRate;
        existing.HasWithholdingExemption = contact.HasWithholdingExemption;
        existing.ExemptionExpiryDate = contact.ExemptionExpiryDate;

        existing.IsPkp = contact.IsPkp;
        existing.PkpDate = contact.PkpDate;

        existing.IsActive = contact.IsActive;
        existing.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return NoContent();
    }

    // DELETE: api/contacts/{id}
    [HttpDelete("{id}")]
    [RequiresPermission(Permissions.ContactsManage)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var contact = await _context.Contacts.FindAsync(id);
        if (contact == null)
            return NotFound();

        // Check if contact is used in invoices
        var hasInvoices = await _context.SalesInvoices.AnyAsync(i => i.ContactId == id);
        if (hasInvoices)
            return BadRequest("Contact is used in invoices and cannot be deleted");

        _context.Contacts.Remove(contact);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    private static void SyncContactType(Contact contact)
    {
        if (contact.IsCustomer && contact.IsVendor)
            contact.Type = ContactType.Both;
        else if (contact.IsVendor)
            contact.Type = ContactType.Vendor;
        else
            contact.Type = ContactType.Customer;
    }

    private async Task<string> GenerateCode(Contact contact)
    {
        var prefix = "C";
        if (contact.IsEmployee)
            prefix = "EMP";
        else if (contact.IsVendor && !contact.IsCustomer)
            prefix = "V";
        else if (contact.IsCustomer && contact.IsVendor)
            prefix = "B";

        var count = await _context.Contacts.CountAsync(c => c.Code.StartsWith(prefix));
        return $"{prefix}-{(count + 1).ToString().PadLeft(4, '0')}";
    }
}
