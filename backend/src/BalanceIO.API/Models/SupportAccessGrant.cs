using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BalanceIO.API.Models;

/// <summary>
/// Time-boxed, audited grant allowing platform support administrators
/// to access a tenant's financial data.
///
/// UU PDP and least-privilege compliance require customer consent before
/// platform operators may inspect tenant books. Outside an active grant or
/// an emergency break-glass event, CompanyScopeMiddleware refuses admin access.
/// </summary>
public class SupportAccessGrant
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    public Guid CompanyId { get; set; }

    [ForeignKey(nameof(CompanyId))]
    public Company? Company { get; set; }

    [Required]
    public Guid GrantedByUserId { get; set; }

    [ForeignKey(nameof(GrantedByUserId))]
    public User? GrantedByUser { get; set; }

    public Guid? GrantedToUserId { get; set; }

    [ForeignKey(nameof(GrantedToUserId))]
    public User? GrantedToUser { get; set; }

    public Guid? TicketId { get; set; }

    public DateTime ValidFrom { get; set; } = DateTime.UtcNow;

    public DateTime ValidUntil { get; set; }

    [Required]
    [MaxLength(500)]
    public string Reason { get; set; } = string.Empty;

    public bool IsRevoked { get; set; } = false;

    public DateTime? RevokedAt { get; set; }

    public Guid? RevokedByUserId { get; set; }
}
