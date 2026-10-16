using BalanceIO.API.Models;
using BalanceIO.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BalanceIO.API.Controllers;

/// <summary>
/// Authorization was missing from this controller entirely. Nothing public
/// calls it - the marketing site only talks to /auth - so requiring a token
/// changes nothing for a signed-in user and closes the endpoint to everyone
/// else. Tenant scoping still comes from the global query filters; this is
/// the layer in front of them, not a replacement for it.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class NotificationsController : ControllerBase
{
    private readonly INotificationService _notificationService;

    public NotificationsController(INotificationService notificationService)
    {
        _notificationService = notificationService;
    }

    // GET: api/notifications/unread
    [HttpGet("unread")]
    public async Task<ActionResult<IEnumerable<Notification>>> GetUnread()
    {
        var notifications = await _notificationService.GetUnreadAsync();
        return Ok(notifications);
    }

    // GET: api/notifications
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Notification>>> GetAll([FromQuery] int limit = 50)
    {
        var notifications = await _notificationService.GetAllAsync(limit);
        return Ok(notifications);
    }

    // POST: api/notifications/{id}/read
    [HttpPost("{id}/read")]
    public async Task<IActionResult> MarkAsRead(Guid id)
    {
        await _notificationService.MarkAsReadAsync(id);
        return NoContent();
    }

    // POST: api/notifications/read-all
    [HttpPost("read-all")]
    public async Task<IActionResult> MarkAllAsRead()
    {
        await _notificationService.MarkAllAsReadAsync();
        return NoContent();
    }
}
