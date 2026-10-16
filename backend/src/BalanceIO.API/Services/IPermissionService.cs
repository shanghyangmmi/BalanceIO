using BalanceIO.API.Security;

namespace BalanceIO.API.Services;

public interface IPermissionService
{
    Task<bool> HasPermissionAsync(Guid userId, Guid companyId, string permission);
    Task<HashSet<string>> GetPermissionsAsync(Guid userId, Guid companyId);
}
