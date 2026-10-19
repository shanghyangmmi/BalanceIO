using System.Net;
using System.Net.Http.Headers;
using System.Text;

namespace BalanceIO.API.Tests;

/// <summary>Evidence attached to a journal entry, and what happens when there is nowhere to keep it.</summary>
public class AttachmentsTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static MultipartFormDataContent Upload(Guid entryId, string fileName = "receipt.pdf")
    {
        var file = new ByteArrayContent(Encoding.ASCII.GetBytes("%PDF-1.4 evidence"));
        file.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        return new MultipartFormDataContent
        {
            { file, "file", fileName },
            { new StringContent("JournalEntry"), "entityType" },
            { new StringContent(entryId.ToString()), "entityId" },
        };
    }

    [Fact]
    public async Task Evidence_attached_to_a_draft_is_listed_and_can_be_removed()
    {
        var t = factory.CreateTenant();
        var id = await t.CreateDraft();
        var client = t.OwnerClient();

        var status = await (await client.GetAsync("/api/Attachments/storage")).Json();
        Assert.True(status.GetProperty("available").GetBoolean());
        Assert.Contains(".pdf", status.GetProperty("extensions").EnumerateArray().Select(e => e.GetString()));

        var upload = await client.PostAsync("/api/Attachments/upload", Upload(id));
        Assert.Equal(HttpStatusCode.OK, upload.StatusCode);
        var attachmentId = (await upload.Json()).GetProperty("id").GetGuid();

        var listed = await (await client.GetAsync($"/api/Attachments/JournalEntry/{id}")).Json();
        Assert.Equal("receipt.pdf", Assert.Single(listed.EnumerateArray()).GetProperty("fileName").GetString());

        var download = await client.GetAsync($"/api/Attachments/{attachmentId}/download");
        Assert.Equal("%PDF-1.4 evidence", await download.Body());

        Assert.Equal(HttpStatusCode.OK, (await client.DeleteAsync($"/api/Attachments/{attachmentId}")).StatusCode);
        Assert.Empty((await (await client.GetAsync($"/api/Attachments/JournalEntry/{id}")).Json()).EnumerateArray());
    }

    [Fact]
    public async Task Without_a_durable_store_uploads_are_refused_and_the_status_says_so()
    {
        using var noStore = factory.WithSettings(("Storage:AllowLocalDisk", "false"));
        var t = factory.CreateTenant();
        var id = await t.CreateDraft();
        var client = noStore.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", t.Owner.Token);
        client.DefaultRequestHeaders.Add("X-Company-Id", t.CompanyId.ToString());

        var status = await (await client.GetAsync("/api/Attachments/storage")).Json();
        Assert.False(status.GetProperty("available").GetBoolean());

        var upload = await client.PostAsync("/api/Attachments/upload", Upload(id));
        Assert.Equal(HttpStatusCode.BadRequest, upload.StatusCode);
        Assert.Contains("STORAGE_UNAVAILABLE", await upload.Body());
        Assert.Empty((await (await client.GetAsync($"/api/Attachments/JournalEntry/{id}")).Json()).EnumerateArray());
    }
}
