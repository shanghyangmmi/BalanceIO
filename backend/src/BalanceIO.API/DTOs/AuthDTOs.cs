using System.ComponentModel.DataAnnotations;

namespace BalanceIO.API.DTOs;

public class RegisterRequest
{
    [Required] public string Name { get; set; } = string.Empty;
    [Required] [EmailAddress] public string Email { get; set; } = string.Empty;
    [Required] [MinLength(6)] public string Password { get; set; } = string.Empty;
}

public class LoginRequest
{
    [Required] [EmailAddress] public string Email { get; set; } = string.Empty;
    [Required] public string Password { get; set; } = string.Empty;
}

public class MfaVerifyRequest
{
    [Required] public string Code { get; set; } = string.Empty;
    public string? Email { get; set; } // Optional if using token
}
