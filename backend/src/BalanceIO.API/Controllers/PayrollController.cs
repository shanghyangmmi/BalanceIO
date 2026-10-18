using BalanceIO.API.Data;
using BalanceIO.API.DTOs;
using BalanceIO.API.Security;
using BalanceIO.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace BalanceIO.API.Controllers;

/// <summary>
/// Employee compensation, monthly payroll runs, and their posting to the
/// general ledger. Every action requires the payroll module on the plan.
/// Rule violations surface as PayrollRuleException, which the exception
/// middleware turns into a status and a code.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PayrollController : ControllerBase, IAsyncActionFilter
{
    private const string Module = "payroll";

    private readonly ApplicationDbContext _context;
    private readonly PayrollService _payroll;
    private readonly ModuleEntitlementService _entitlement;
    private readonly IDocumentHistoryService _historyService;

    public PayrollController(
        ApplicationDbContext context,
        PayrollService payroll,
        ModuleEntitlementService entitlement,
        IDocumentHistoryService historyService)
    {
        _context = context;
        _payroll = payroll;
        _entitlement = entitlement;
        _historyService = historyService;
    }

    /// <summary>Company scope and module entitlement, checked once for every action.</summary>
    [NonAction]
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        if (!_context.CurrentCompanyId.HasValue)
        {
            context.Result = BadRequest(new { code = "COMPANY_REQUIRED", message = "Company context is required. Send the X-Company-Id header." });
            return;
        }

        if (!await _entitlement.HasAsync(_context.CurrentCompanyId.Value, Module))
        {
            context.Result = StatusCode(StatusCodes.Status402PaymentRequired, new
            {
                error = "MODULE_NOT_ENTITLED",
                module = Module,
                message = "This module is not included in the company's current plan.",
            });
            return;
        }

        await next();
    }

    private Guid CompanyId => _context.CurrentCompanyId!.Value;

    private static DateOnly TodayWib => DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));

    private PayrollService.Actor? Actor()
    {
        var claim = User.FindFirst("id")?.Value
                 ?? User.FindFirst("sub")?.Value
                 ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(claim, out var id) || id == Guid.Empty) return null;

        var label = User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value
                 ?? User.FindFirst("email")?.Value
                 ?? id.ToString();
        return new PayrollService.Actor(id, label);
    }

    [HttpGet("overview")]
    [RequiresPermission(Permissions.PayrollView)]
    public async Task<ActionResult<PayrollOverviewDto>> GetOverview() =>
        Ok(await _payroll.GetOverviewAsync(CompanyId, TodayWib));

    [HttpGet("employees")]
    [RequiresPermission(Permissions.PayrollView)]
    public async Task<ActionResult<List<PayrollEmployeeDto>>> GetEmployees() =>
        Ok(await _payroll.GetEmployeesAsync(CompanyId));

    [HttpPut("employees/{contactId:guid}/compensation")]
    [RequiresPermission(Permissions.PayrollManage)]
    public async Task<ActionResult<PayrollCompensationDto>> UpsertCompensation(Guid contactId, [FromBody] UpsertCompensationRequest request) =>
        Ok(await _payroll.UpsertCompensationAsync(CompanyId, contactId, request));

    [HttpGet("runs")]
    [RequiresPermission(Permissions.PayrollView)]
    public async Task<ActionResult<List<PayrollRunSummaryDto>>> GetRuns() =>
        Ok(await _payroll.RunSummariesAsync(CompanyId));

    [HttpGet("runs/{id:guid}")]
    [RequiresPermission(Permissions.PayrollView)]
    public async Task<ActionResult<PayrollRunDetailDto>> GetRun(Guid id) =>
        Ok(await _payroll.GetRunAsync(CompanyId, id, Actor()));

    [HttpPost("runs")]
    [RequiresPermission(Permissions.PayrollManage)]
    public async Task<ActionResult<PayrollRunDetailDto>> CreateRun([FromBody] CreatePayrollRunRequest request)
    {
        var actor = Actor();
        if (actor is null) return Unauthorized();

        var run = await _payroll.CreateRunAsync(CompanyId, request, actor);
        await _historyService.RecordEventAsync(
            CompanyId,
            "PayrollRun",
            run.Id,
            "Created",
            actor.UserId,
            actor.Label,
            $"Payroll run created for {run.Period}");

        return CreatedAtAction(nameof(GetRun), new { id = run.Id }, run);
    }

    [HttpPost("runs/{id:guid}/recalculate")]
    [RequiresPermission(Permissions.PayrollManage)]
    public async Task<ActionResult<PayrollRunDetailDto>> Recalculate(Guid id)
    {
        var actor = Actor();
        if (actor is null) return Unauthorized();
        return Ok(await _payroll.RecalculateAsync(CompanyId, id, actor));
    }

    [HttpPut("runs/{id:guid}/lines/{lineId:guid}")]
    [RequiresPermission(Permissions.PayrollManage)]
    public async Task<ActionResult<PayrollRunDetailDto>> UpdateLine(Guid id, Guid lineId, [FromBody] UpdatePayrollLineRequest request)
    {
        var actor = Actor();
        if (actor is null) return Unauthorized();
        return Ok(await _payroll.RecalculateAsync(CompanyId, id, actor, lineId, request.OtherEarnings));
    }

    [HttpPost("runs/{id:guid}/post")]
    [RequiresPermission(Permissions.PayrollApprove)]
    public async Task<ActionResult<PayrollRunDetailDto>> Post(Guid id)
    {
        var actor = Actor();
        if (actor is null) return Unauthorized();
        var result = await _payroll.PostAsync(CompanyId, id, actor);

        await _historyService.RecordEventAsync(
            CompanyId,
            "PayrollRun",
            id,
            "Posted",
            actor.UserId,
            actor.Label,
            $"Payroll run approved and posted to General Ledger (Journal: {result.JournalEntryId})");

        return Ok(result);
    }

    [HttpPost("runs/{id:guid}/void")]
    [RequiresPermission(Permissions.PayrollApprove)]
    public async Task<ActionResult<PayrollRunDetailDto>> Void(Guid id, [FromBody] VoidPayrollRunRequest? request)
    {
        var actor = Actor();
        if (actor is null) return Unauthorized();
        var result = await _payroll.VoidAsync(CompanyId, id, actor, request?.Reason);

        await _historyService.RecordEventAsync(
            CompanyId,
            "PayrollRun",
            id,
            "Voided",
            actor.UserId,
            actor.Label,
            request?.Reason ?? "Payroll run voided");

        return Ok(result);
    }

    [HttpDelete("runs/{id:guid}")]
    [RequiresPermission(Permissions.PayrollManage)]
    public async Task<IActionResult> DeleteRun(Guid id)
    {
        await _payroll.DeleteDraftAsync(CompanyId, id);
        return NoContent();
    }
}
