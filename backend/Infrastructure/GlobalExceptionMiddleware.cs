using System.Text.Json;

namespace backend.Infrastructure;

/// <summary>
/// Middleware global que captura cualquier excepción no controlada en el pipeline
/// y devuelve un shape JSON consistente al cliente, sin filtrar ex.Message ni stack.
///
/// Los controllers existentes con sus try/catch propios siguen funcionando igual;
/// este middleware sólo actúa cuando algo escapa a esos catch. El ErrorId devuelto
/// es el TraceIdentifier de ASP.NET Core, útil para correlacionar con los logs de
/// Railway al investigar un incidente.
/// </summary>
public class GlobalExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<GlobalExceptionMiddleware> _logger;

    public GlobalExceptionMiddleware(RequestDelegate next, ILogger<GlobalExceptionMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            // Stack completo queda en logs server-side (Railway).
            _logger.LogError(ex,
                "[GlobalExceptionMiddleware] Excepción no controlada — Path={Path}, Method={Method}, TraceId={TraceId}",
                context.Request.Path, context.Request.Method, context.TraceIdentifier);

            if (context.Response.HasStarted)
            {
                // Si ya empezamos a escribir la respuesta no podemos cambiarla.
                _logger.LogWarning("[GlobalExceptionMiddleware] La respuesta ya había empezado, no se puede formatear el error.");
                return;
            }

            context.Response.Clear();
            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            context.Response.ContentType = "application/json; charset=utf-8";

            var payload = new
            {
                error = "internal_error",
                mensaje = "Ha ocurrido un error. Si el problema persiste, repórtalo.",
                errorId = context.TraceIdentifier,
            };

            await JsonSerializer.SerializeAsync(context.Response.Body, payload);
        }
    }
}
