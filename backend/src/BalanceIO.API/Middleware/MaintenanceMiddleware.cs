using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Hosting;
using System.IO;
using System.Threading.Tasks;

namespace BalanceIO.API.Middleware
{
    public class MaintenanceMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly IWebHostEnvironment _env;

        public MaintenanceMiddleware(RequestDelegate next, IWebHostEnvironment env)
        {
            _next = next;
            _env = env;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            // Define whitelisted paths that should bypass maintenance mode
            var path = context.Request.Path.Value?.ToLower();
            
            // Allow Admin API, Auth API, and Swagger/Health checks if any
            // Also allow static files if needed, but usually API is the concern.
            if (path != null && (
                path.StartsWith("/api/admin") || 
                path.StartsWith("/api/auth") ||
                path.StartsWith("/swagger")
            ))
            {
                await _next(context);
                return;
            }

            // Check for lock file
            var lockFile = Path.Combine(_env.ContentRootPath, "maintenance.lock");
            if (File.Exists(lockFile))
            {
                context.Response.StatusCode = 503;
                context.Response.ContentType = "application/json";
                await context.Response.WriteAsync("{\"message\": \"System is currently under maintenance. Please try again later.\"}");
                return;
            }

            await _next(context);
        }
    }
}
