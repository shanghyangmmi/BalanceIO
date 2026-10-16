using BalanceIO.API.Data;
using BalanceIO.API.Models;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Services;

public interface INotificationService
{
    Task CreateAsync(string title, string message, string type = "info", string? relatedEntityId = null, string? relatedEntityType = null);
    Task MarkAsReadAsync(Guid id);
    Task MarkAllAsReadAsync();
    Task<IEnumerable<Notification>> GetUnreadAsync();
    Task<IEnumerable<Notification>> GetAllAsync(int limit = 50);
}

public class NotificationService : INotificationService
{
    private readonly ApplicationDbContext _context;

    public NotificationService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task CreateAsync(string title, string message, string type = "info", string? relatedEntityId = null, string? relatedEntityType = null)
    {
        var notification = new Notification
        {
            Id = Guid.NewGuid(),
            Title = title,
            Message = message,
            Type = type,
            CreatedAt = DateTime.UtcNow,
            RelatedEntityId = relatedEntityId,
            RelatedEntityType = relatedEntityType,
            IsRead = false
        };

        _context.Notifications.Add(notification);
        await _context.SaveChangesAsync();
    }

    public async Task MarkAsReadAsync(Guid id)
    {
        var notification = await _context.Notifications.FindAsync(id);
        if (notification != null)
        {
            notification.IsRead = true;
            await _context.SaveChangesAsync();
        }
    }

    public async Task MarkAllAsReadAsync()
    {
        // Simple implementation for single user context
        var unread = _context.Notifications.Where(n => !n.IsRead);
        foreach (var n in unread)
        {
            n.IsRead = true;
        }
        await _context.SaveChangesAsync();
    }

    public async Task<IEnumerable<Notification>> GetUnreadAsync()
    {
        return await _context.Notifications
            .Where(n => !n.IsRead)
            .OrderByDescending(n => n.CreatedAt)
            .Take(10) // Limit header notifications
            .ToListAsync();
    }

    public async Task<IEnumerable<Notification>> GetAllAsync(int limit = 50)
    {
        return await _context.Notifications
            .OrderByDescending(n => n.CreatedAt)
            .Take(limit)
            .ToListAsync();
    }
}
