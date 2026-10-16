using System.Security.Claims;
using BalanceIO.API.DTOs;
using BalanceIO.API.Security;
using BalanceIO.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BalanceIO.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class E2EValidationController : ControllerBase
{
    private readonly E2EAccountingValidationService _validationService;
    private readonly AuditService _auditService;

    public E2EValidationController(
        E2EAccountingValidationService validationService,
        AuditService auditService)
    {
        _validationService = validationService;
        _auditService = auditService;
    }

    private string GetCurrentUserEmail()
    {
        return User.FindFirst(ClaimTypes.Email)?.Value 
            ?? User.FindFirst("email")?.Value 
            ?? User.Identity?.Name 
            ?? "auditor@balanceio.id";
    }

    private Guid? GetCurrentUserId()
    {
        var claim = User.FindFirst("id")?.Value 
                 ?? User.FindFirst("sub")?.Value 
                 ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(claim, out var id) ? id : null;
    }

    /// <summary>
    /// Trigger automated 12-phase statutory accounting lifecycle validation
    /// </summary>
    [HttpPost("run-cycle")]
    [RequiresPermission(Permissions.AuditView)]
    public async Task<ActionResult<E2ELifecycleValidationResultDto>> RunCycle()
    {
        var user = GetCurrentUserEmail();
        var result = await _validationService.RunFullLifecycleSimulationAsync(user);

        await _auditService.LogAsync(
            GetCurrentUserId() ?? Guid.Empty,
            "E2E_LIFECYCLE_VALIDATION_EXECUTED",
            result.ExecutionId,
            $"Executed full 12-phase accounting cycle validation: {result.PassedPhases}/12 phases passed ({result.OverallStatus})"
        );

        return Ok(result);
    }

    /// <summary>
    /// Retrieve latest accounting lifecycle validation audit results
    /// </summary>
    [HttpGet("latest-run")]
    [RequiresPermission(Permissions.AuditView)]
    public ActionResult<E2ELifecycleValidationResultDto> GetLatestRun()
    {
        var latest = _validationService.GetLatestResult();
        if (latest == null)
        {
            return Ok(new { message = "Simulasi siklus akuntansi belum pernah dijalankan." });
        }
        return Ok(latest);
    }
}
