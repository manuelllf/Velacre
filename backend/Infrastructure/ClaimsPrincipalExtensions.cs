using System.Security.Claims;

namespace backend.Infrastructure;

public static class ClaimsPrincipalExtensions
{
    /// <summary>
    /// Extracts the authenticated user's ID from the JWT "sub" claim.
    /// Throws InvalidOperationException if the claim is missing (should never happen behind [Authorize]).
    /// </summary>
    public static Guid GetUserId(this ClaimsPrincipal principal)
    {
        var sub = principal.FindFirst("sub")?.Value
            ?? throw new InvalidOperationException("JWT claim 'sub' not found. Is the endpoint protected with [Authorize]?");
        return Guid.Parse(sub);
    }
}
