using BalanceIO.API.Data;
using BalanceIO.API.Security;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Services;

public class PermissionService : IPermissionService
{
    private readonly ApplicationDbContext _context;
    // Simple request-scoped cache key could be (userId, companyId) -> permissions
    // But since this service is Scoped, we can just cache the result of the first call.
    private HashSet<string>? _cachedPermissions;
    private Guid? _cachedUserId;
    private Guid? _cachedCompanyId;

    public PermissionService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<bool> HasPermissionAsync(Guid userId, Guid companyId, string permission)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user != null && user.IsAdmin)
        {
            return true;
        }

        var permissions = await GetPermissionsAsync(userId, companyId);
        return permissions.Contains(permission);
    }

    public async Task<HashSet<string>> GetPermissionsAsync(Guid userId, Guid companyId)
    {
        // Return cached if matches
        if (_cachedPermissions != null && _cachedUserId == userId && _cachedCompanyId == companyId)
        {
            return _cachedPermissions;
        }

        var user = await _context.Users.FindAsync(userId);
        if (user != null && user.IsAdmin)
        {
            _cachedPermissions = new HashSet<string>(RolePermissions.GetPermissions(RolePermissions.RoleOwner));
            _cachedUserId = userId;
            _cachedCompanyId = companyId;
            return _cachedPermissions;
        }

        var userCompany = await _context.UserCompanies
            .FirstOrDefaultAsync(uc => uc.UserId == userId && uc.CompanyId == companyId);

        if (userCompany == null)
        {
            return new HashSet<string>();
        }

        // Map Role to Permissions
        // Using Reflection or the Dictionary we created in RolePermissions
        // We need to expose the dictionary or stick to GetPermissions method
        var perms = RolePermissions.GetPermissions(userCompany.Role);
        
        _cachedPermissions = new HashSet<string>(perms);
        _cachedUserId = userId;
        _cachedCompanyId = companyId;

        return _cachedPermissions;
    }
}
