using System.ComponentModel.DataAnnotations;

namespace BalanceIO.API.DTOs;

public class CreateCostCenterRequest
{
    [Required]
    [MaxLength(50)]
    public string Code { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

    public Guid? ParentId { get; set; }

    public Guid? ManagerContactId { get; set; }

    public bool IsActive { get; set; } = true;
}

public class UpdateCostCenterRequest
{
    [Required]
    [MaxLength(50)]
    public string Code { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

    public Guid? ParentId { get; set; }

    public Guid? ManagerContactId { get; set; }

    public bool IsActive { get; set; } = true;

    public bool IsDiscontinued { get; set; } = false;

    public DateOnly? DiscontinuedDate { get; set; }
}

public class CostCenterDto
{
    public Guid Id { get; set; }
    public Guid CompanyId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public Guid? ParentId { get; set; }
    public string? ParentName { get; set; }
    public Guid? ManagerContactId { get; set; }
    public string? ManagerName { get; set; }
    public bool IsActive { get; set; }
    public bool IsDiscontinued { get; set; }
    public DateOnly? DiscontinuedDate { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public List<CostCenterDto> Children { get; set; } = new();
}
