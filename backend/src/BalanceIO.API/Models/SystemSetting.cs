using System.ComponentModel.DataAnnotations;

namespace BalanceIO.API.Models;

/// <summary>
/// Global System Settings (Key-Value Store)
/// </summary>
public class SystemSetting
{
    [Key]
    [MaxLength(100)]
    public string Key { get; set; } = string.Empty;

    [MaxLength(2000)]
    public string Value { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

    [MaxLength(50)]
    public string DataType { get; set; } = "string"; // string, bool, int, json
}
