using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using BalanceIO.API.Data;
using BalanceIO.API.DTOs;
using BalanceIO.API.Models;
using BalanceIO.API.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace BalanceIO.API.Tests;

public class AuditHistoryAndTicketingTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private readonly JsonSerializerOptions _json = new() { PropertyNameCaseInsensitive = true };

    private async Task<TestUser> CreatePlatformAdminUser()
    {
        var admin = new User
        {
            Id = Guid.NewGuid(),
            Name = "Platform Admin",
            Email = $"admin-{Guid.NewGuid():N}@balanceio.id",
            IsEmailVerified = true,
            IsAdmin = true
        };
        await factory.WithDb(async db =>
        {
            db.Users.Add(admin);
            await db.SaveChangesAsync();
        });
        using var scope = factory.Services.CreateScope();
        var token = scope.ServiceProvider.GetRequiredService<JwtService>().GenerateToken(admin);
        return new TestUser(admin.Id, admin.Email, token);
    }

    [Fact]
    public async Task JournalEntry_Lifecycle_RecordsDocumentHistoryEvents_WithCryptographicHashChain()
    {
        var tenant = factory.CreateTenant();
        var client = tenant.OwnerClient();

        // 1. Create a draft journal entry
        var createPayload = new
        {
            date = DateOnly.FromDateTime(DateTime.UtcNow),
            referenceNumber = "JE-AUDIT-001",
            notes = "Audit test entry",
            lines = new[]
            {
                new { accountId = tenant.Cash.Id, description = "Cash debit", debit = 500_000m, credit = 0m },
                new { accountId = tenant.Revenue.Id, description = "Revenue credit", debit = 0m, credit = 500_000m }
            }
        };

        var createRes = await client.PostJson("/api/JournalEntries", createPayload);
        Assert.Equal(HttpStatusCode.Created, createRes.StatusCode);
        var entry = await createRes.Content.ReadFromJsonAsync<JournalEntry>(_json);
        Assert.NotNull(entry);

        // 2. Update the draft entry
        var updatePayload = new
        {
            date = DateOnly.FromDateTime(DateTime.UtcNow),
            referenceNumber = "JE-AUDIT-001",
            notes = "Audit test entry updated",
            lines = new[]
            {
                new { accountId = tenant.Cash.Id, description = "Cash debit updated", debit = 600_000m, credit = 0m },
                new { accountId = tenant.Revenue.Id, description = "Revenue credit updated", debit = 0m, credit = 600_000m }
            }
        };

        var updateRes = await client.PutAsJsonAsync($"/api/JournalEntries/{entry.Id}", updatePayload);
        var updateBody = await updateRes.Content.ReadAsStringAsync();
        if (updateRes.StatusCode != HttpStatusCode.NoContent)
            Assert.Fail($"PutJournalEntry failed ({updateRes.StatusCode}): {updateBody}");

        // 3. Post the entry with second reviewer (Segregation of Duties)
        var reviewerClient = factory.ClientFor(tenant.CompanyId, tenant.Reviewer);
        var postRes = await reviewerClient.PostAsync($"/api/JournalEntries/{entry.Id}/post", null);
        Assert.Equal(HttpStatusCode.OK, postRes.StatusCode);

        // 4. Retrieve document history timeline
        var historyRes = await client.GetAsync($"/api/documents/JournalEntry/{entry.Id}/history");
        Assert.Equal(HttpStatusCode.OK, historyRes.StatusCode);

        var events = await historyRes.Content.ReadFromJsonAsync<List<DocumentHistoryEvent>>(_json);
        Assert.NotNull(events);
        Assert.Equal(3, events.Count);

        // Verify actions
        Assert.Equal("Created", events[0].Action);
        Assert.Equal("Updated", events[1].Action);
        Assert.Equal("Posted", events[2].Action);

        // Verify cryptographic SHA-256 hash chaining
        Assert.Empty(events[0].PreviousHash);
        Assert.NotEmpty(events[0].RowHash);
        Assert.Equal(64, events[0].RowHash.Length);

        Assert.Equal(events[0].RowHash, events[1].PreviousHash);
        Assert.NotEmpty(events[1].RowHash);
        Assert.Equal(64, events[1].RowHash.Length);

        Assert.Equal(events[1].RowHash, events[2].PreviousHash);
        Assert.NotEmpty(events[2].RowHash);
        Assert.Equal(64, events[2].RowHash.Length);
    }

    [Fact]
    public async Task DocumentHistory_TenantIsolation_RefusesForeignTenant()
    {
        var tenantA = factory.CreateTenant();
        var tenantB = factory.CreateTenant();

        // Tenant A creates an entry
        var createRes = await tenantA.OwnerClient().PostJson("/api/JournalEntries", new
        {
            date = DateOnly.FromDateTime(DateTime.UtcNow),
            referenceNumber = "JE-TENANT-A",
            lines = new[]
            {
                new { accountId = tenantA.Cash.Id, description = "Cash", debit = 100_000m, credit = 0m },
                new { accountId = tenantA.Revenue.Id, description = "Revenue", debit = 0m, credit = 100_000m }
            }
        });
        var entryA = await createRes.Content.ReadFromJsonAsync<JournalEntry>(_json);
        Assert.NotNull(entryA);

        // Tenant B attempts to read Tenant A's document history
        var foreignReadRes = await tenantB.OwnerClient().GetAsync($"/api/documents/JournalEntry/{entryA.Id}/history");
        Assert.Equal(HttpStatusCode.NotFound, foreignReadRes.StatusCode);
    }

    [Fact]
    public async Task AuditLogs_Events_FilterEndpoint_ReturnsPagedFilteredEvents()
    {
        var tenant = factory.CreateTenant();
        var client = tenant.OwnerClient();

        var customer = new Contact
        {
            Id = Guid.NewGuid(),
            CompanyId = tenant.CompanyId,
            Name = "Customer Audit PT",
            Type = ContactType.Customer
        };
        await factory.WithDb(async db => { db.Contacts.Add(customer); await db.SaveChangesAsync(); }, tenant.CompanyId);

        // Create an invoice
        var invRes = await client.PostJson("/api/salesinvoices", new
        {
            contactId = customer.Id,
            invoiceDate = DateOnly.FromDateTime(DateTime.UtcNow),
            dueDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)),
            lines = new[]
            {
                new { description = "Service", quantity = 1m, unitPrice = 1_000_000m, isTaxable = false }
            }
        });
        Assert.Equal(HttpStatusCode.Created, invRes.StatusCode);

        // Query /api/audit-logs/events filter
        var filterRes = await client.GetAsync("/api/audit-logs/events?documentType=SalesInvoice");
        Assert.Equal(HttpStatusCode.OK, filterRes.StatusCode);

        using var doc = await JsonDocument.ParseAsync(await filterRes.Content.ReadAsStreamAsync());
        var dataArray = doc.RootElement.GetProperty("data");
        Assert.True(dataArray.GetArrayLength() >= 1);
        Assert.Equal("SalesInvoice", dataArray[0].GetProperty("documentType").GetString());
    }

    [Fact]
    public async Task AuditPrune_RejectsRetentionShorterThan10Years_UnderUU_KUP_Pasal_28()
    {
        // UU KUP Pasal 28 requires books and records retention of at least 10 years (3,650 days)
        var tenant = factory.CreateTenant();

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Audit:RetentionDays"] = "365" // < 3650 days
            })
            .Build();

        await factory.WithDb(async db =>
        {
            var ex = await Assert.ThrowsAsync<InvalidOperationException>(async () =>
            {
                var runnerType = typeof(ScheduledJobRunner);
                var dispatchMethod = runnerType.GetMethod("DispatchAsync",
                    System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);

                Assert.NotNull(dispatchMethod);

                var sp = new ServiceCollection()
                    .AddSingleton<IConfiguration>(config)
                    .BuildServiceProvider();

                try
                {
                    var task = (Task<string>)dispatchMethod.Invoke(null, new object[] { "audit-prune", sp, db, CancellationToken.None })!;
                    await task;
                }
                catch (System.Reflection.TargetInvocationException tie) when (tie.InnerException is not null)
                {
                    throw tie.InnerException;
                }
            });

            Assert.Contains("UU KUP Pasal 28", ex.Message);
            Assert.Contains("3,650 days", ex.Message);
        }, tenant.CompanyId);
    }

    [Fact]
    public async Task SupportTicket_Lifecycle_WithConsentGrant_AndConfidentialInternalNotes()
    {
        var tenant = factory.CreateTenant();
        var customerClient = tenant.OwnerClient();

        // 1. Tenant creates a support ticket with diagnostic consent access requested
        var createDto = new CreateSupportTicketDto
        {
            Subject = "Need help with bank reconciliation",
            Category = SupportTicketCategory.Accounting,
            Priority = SupportTicketPriority.High,
            Message = "My bank balance has an unexplained difference of Rp 50,000.",
            DiagnosticContextJson = "{\"route\":\"/dashboard/accounting/bank-reconciliation\",\"browser\":\"Chrome 122\"}",
            GrantSupportAccess = true,
            SupportAccessHours = 48
        };

        var createRes = await customerClient.PostJson("/api/support/tickets", createDto);
        Assert.Equal(HttpStatusCode.Created, createRes.StatusCode);

        var ticket = await createRes.Content.ReadFromJsonAsync<SupportTicket>(_json);
        Assert.NotNull(ticket);
        Assert.StartsWith("TICK-", ticket.TicketNumber);
        Assert.Equal(SupportTicketStatus.Open, ticket.Status);

        // Verify SupportAccessGrant was created in the database
        await factory.WithDb(async db =>
        {
            var grant = await db.SupportAccessGrants
                .FirstOrDefaultAsync(g => g.CompanyId == tenant.CompanyId && g.TicketId == ticket.Id);

            Assert.NotNull(grant);
            Assert.False(grant.IsRevoked);
            Assert.True(grant.ValidUntil > DateTime.UtcNow.AddHours(40));
        }, tenant.CompanyId);

        // 2. Admin retrieves ticket via platform admin API
        var admin = await CreatePlatformAdminUser();
        var adminClient = factory.ClientFor(tenant.CompanyId, admin);

        var adminGetRes = await adminClient.GetAsync($"/api/admin/support/tickets/{ticket.Id}");
        Assert.Equal(HttpStatusCode.OK, adminGetRes.StatusCode);

        // 3. Admin posts an internal note (confidential)
        var internalNoteDto = new AddTicketMessageDto
        {
            MessageText = "Investigating ledger lines: looks like unposted rounding difference.",
            IsInternalAdminNote = true
        };
        var adminInternalRes = await adminClient.PostJson($"/api/admin/support/tickets/{ticket.Id}/messages", internalNoteDto);
        Assert.Equal(HttpStatusCode.OK, adminInternalRes.StatusCode);

        // 4. Verify tenant DOES NOT see the internal admin note
        var tenantGetRes = await customerClient.GetAsync($"/api/support/tickets/{ticket.Id}");
        Assert.Equal(HttpStatusCode.OK, tenantGetRes.StatusCode);

        using var tenantDoc = await JsonDocument.ParseAsync(await tenantGetRes.Content.ReadAsStreamAsync());
        var tenantMessages = tenantDoc.RootElement.GetProperty("messages");
        // Only initial message should be visible to tenant
        Assert.Equal(1, tenantMessages.GetArrayLength());

        // 5. Admin posts a public reply to the customer
        var publicReplyDto = new AddTicketMessageDto
        {
            MessageText = "Hello! We inspected your transaction and found an unposted draft journal.",
            IsInternalAdminNote = false
        };
        var adminPublicRes = await adminClient.PostJson($"/api/admin/support/tickets/{ticket.Id}/messages", publicReplyDto);
        Assert.Equal(HttpStatusCode.OK, adminPublicRes.StatusCode);

        // Ticket status should automatically transition to WaitingOnCustomer
        var adminTicketCheck = await adminClient.GetAsync($"/api/admin/support/tickets/{ticket.Id}");
        using var checkDoc = await JsonDocument.ParseAsync(await adminTicketCheck.Content.ReadAsStreamAsync());
        var statusProp = checkDoc.RootElement.GetProperty("status");
        var statusVal = statusProp.ValueKind == JsonValueKind.Number ? (SupportTicketStatus)statusProp.GetInt32() : Enum.Parse<SupportTicketStatus>(statusProp.GetString()!);
        Assert.Equal(SupportTicketStatus.WaitingOnCustomer, statusVal);

        // 6. Customer reads ticket and replies
        var tenantReplyDto = new AddTicketMessageDto
        {
            MessageText = "Thank you! I posted the draft journal and everything balances now."
        };
        var custReplyRes = await customerClient.PostJson($"/api/support/tickets/{ticket.Id}/messages", tenantReplyDto);
        Assert.Equal(HttpStatusCode.OK, custReplyRes.StatusCode);

        // 7. Customer closes the ticket
        var closeRes = await customerClient.PostAsync($"/api/support/tickets/{ticket.Id}/close", null);
        Assert.Equal(HttpStatusCode.OK, closeRes.StatusCode);

        using var closeDoc = await JsonDocument.ParseAsync(await closeRes.Content.ReadAsStreamAsync());
        var closeProp = closeDoc.RootElement.GetProperty("status");
        var closeVal = closeProp.ValueKind == JsonValueKind.Number ? (SupportTicketStatus)closeProp.GetInt32() : Enum.Parse<SupportTicketStatus>(closeProp.GetString()!);
        Assert.Equal(SupportTicketStatus.Closed, closeVal);
    }
}
