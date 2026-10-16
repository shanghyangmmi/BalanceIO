using Microsoft.AspNetCore.Mvc;

namespace BalanceIO.API.Security;

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true, Inherited = true)]
public class RequiresPermissionAttribute : TypeFilterAttribute
{
    public string Permission { get; }

    public RequiresPermissionAttribute(string permission) : base(typeof(PermissionFilter))
    {
        Permission = permission;
        Arguments = new object[] { permission };
    }
}
