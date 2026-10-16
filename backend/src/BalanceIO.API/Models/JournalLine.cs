using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BalanceIO.API.Models;

public class JournalLine
{
    public Guid Id { get; set; }

    public Guid JournalEntryId { get; set; }
    
    // Limits recursion in simplistic serializers, though DTOs are better.
    [System.Text.Json.Serialization.JsonIgnore] 
    public JournalEntry? JournalEntry { get; set; }

    [Required]
    [MaxLength(100)]
    public string AccountId { get; set; } = string.Empty;

    [MaxLength(255)]
    public string? Description { get; set; }

    [Column(TypeName = "decimal(19,4)")]
    public decimal Debit { get; set; }

    [Column(TypeName = "decimal(19,4)")]
    public decimal Credit { get; set; }

    [MaxLength(50)]
    public string? Tax { get; set; } // Comma separated codes if multiple
}
