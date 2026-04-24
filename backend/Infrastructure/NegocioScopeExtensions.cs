using backend.Interfaces;
using backend.Models.Entities;
using Microsoft.AspNetCore.Http;

namespace backend.Infrastructure;

/// <summary>
/// Helper de alcance multi-negocio. El frontend pasa <c>?negocio_id=</c> como query string
/// para indicar con qué local opera el endpoint. Si no llega, se usa el primario del usuario.
/// </summary>
public static class NegocioScopeExtensions
{
    private const string QueryParamName = "negocio_id";
    private const string HeaderName     = "X-Negocio-Id";

    /// <summary>
    /// Extrae el id solicitado del header <c>X-Negocio-Id</c> o del query string <c>?negocio_id=</c>.
    /// El header tiene prioridad porque es lo que usa el cliente web; el query param queda como
    /// fallback para URLs compartibles.
    /// </summary>
    private static string? ExtractRequestedId(HttpContext httpContext)
    {
        var fromHeader = httpContext.Request.Headers[HeaderName].ToString();
        if (!string.IsNullOrEmpty(fromHeader)) return fromHeader;
        var fromQuery = httpContext.Request.Query[QueryParamName].ToString();
        return string.IsNullOrEmpty(fromQuery) ? null : fromQuery;
    }

    /// <summary>
    /// Resuelve el negocio sobre el que opera el request:
    /// - Si viene <c>?negocio_id=</c> en query: valida que pertenece al usuario y lo devuelve.
    /// - Si no: devuelve el primario del usuario (compat con cuentas mono-negocio y fallback cuando el front aún no pasa el id).
    /// </summary>
    /// <returns>Tupla (Negocio, Error). Exactamente uno de los dos no es null.</returns>
    public static async Task<(NegocioEntity? Negocio, string? Error)> ResolveNegocioAsync(
        this INegocioRepository repo,
        HttpContext httpContext,
        Guid userId)
    {
        var raw = ExtractRequestedId(httpContext);

        if (!string.IsNullOrEmpty(raw))
        {
            if (!Guid.TryParse(raw, out var requestedId))
                return (null, "invalid_negocio_id");

            var owned = await repo.GetByIdAndUserIdAsync(requestedId, userId);
            if (owned == null)
                return (null, "negocio_not_found");

            return (owned, null);
        }

        var primary = await repo.GetByUserIdAsync(userId);
        if (primary == null)
            return (null, "no_negocio");

        return (primary, null);
    }

    /// <summary>
    /// Drop-in reemplazo de <c>GetByUserIdAsync</c> que respeta <c>?negocio_id=</c>.
    /// Devuelve null si el id es inválido, no pertenece al usuario, o no hay ningún negocio.
    /// </summary>
    public static async Task<NegocioEntity?> ResolveScopedAsync(
        this INegocioRepository repo,
        HttpContext httpContext,
        Guid userId)
    {
        var raw = ExtractRequestedId(httpContext);
        if (!string.IsNullOrEmpty(raw))
        {
            if (!Guid.TryParse(raw, out var requestedId)) return null;
            return await repo.GetByIdAndUserIdAsync(requestedId, userId);
        }
        return await repo.GetByUserIdAsync(userId);
    }
}
