using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using backend.Interfaces;
using backend.Models.Entities;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class GoogleController : ControllerBase
{
    private readonly IGoogleBusinessService _gbp;
    private readonly Supabase.Client _supabase;
    private readonly ILogger<GoogleController> _logger;

    public GoogleController(IGoogleBusinessService gbp, Supabase.Client supabase, ILogger<GoogleController> logger)
    {
        _gbp      = gbp;
        _supabase = supabase;
        _logger   = logger;
    }

    // ─── GET /api/google/auth-url ─────────────────────────────────────────────
    /// <summary>
    /// Devuelve la URL de autorización OAuth de Google.
    /// El frontend redirige al usuario a esa URL mediante window.location.href.
    /// </summary>
    [HttpGet("auth-url")]
    [Authorize]
    public async Task<IActionResult> GetAuthUrl([FromQuery] string negocioId, [FromQuery] string returnTo = "onboarding")
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);

        if (!Guid.TryParse(negocioId, out var negocioGuid))
            return BadRequest("negocioId inválido");

        // Verificar que el negocio pertenece al usuario
        var negocioResult = await _supabase.From<NegocioEntity>()
            .Where(n => n.Id == negocioGuid && n.IdUsuario == userId)
            .Limit(1)
            .Get();

        if (negocioResult.Models.Count == 0)
            return NotFound("Negocio no encontrado");

        var url = _gbp.GenerateAuthUrl(negocioGuid, userId, returnTo);
        _logger.LogInformation("[GoogleController] Auth URL generada para userId={UserId}, negocioId={NegocioId}", userId, negocioGuid);

        return Ok(new { url });
    }

    // ─── GET /api/google/callback ─────────────────────────────────────────────
    /// <summary>
    /// Callback público de OAuth (Google redirige aquí).
    /// No lleva JWT — la autenticación se valida mediante el state firmado.
    /// </summary>
    [HttpGet("callback")]
    [AllowAnonymous]
    public async Task<IActionResult> Callback([FromQuery] string? code, [FromQuery] string? state, [FromQuery] string? error)
    {
        var frontendBase = Environment.GetEnvironmentVariable("FRONTEND_URL") ?? "http://localhost:3000";

        if (!string.IsNullOrEmpty(error))
        {
            _logger.LogWarning("[GoogleController] OAuth rechazado por el usuario: {Error}", error);
            return Redirect($"{frontendBase}/onboarding?gbp=error&msg=access_denied");
        }

        if (string.IsNullOrEmpty(code) || string.IsNullOrEmpty(state))
            return Redirect($"{frontendBase}/onboarding?gbp=error&msg=missing_params");

        var result = await _gbp.HandleCallbackAsync(code, state);

        _logger.LogInformation("[GoogleController] Callback procesado: success={Ok}, autoSelected={Auto}, redirect={Url}",
            result.Success, result.AutoSelected, result.RedirectUrl);

        return Redirect(result.RedirectUrl);
    }

    // ─── GET /api/google/status ───────────────────────────────────────────────
    /// <summary>Estado de la conexión GBP del negocio del usuario</summary>
    [HttpGet("status")]
    [Authorize]
    public async Task<IActionResult> GetStatus()
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);

        var negocio = await GetNegocioForUserAsync(userId);
        if (negocio == null) return NotFound("Negocio no encontrado");

        var conn = await _gbp.GetConnectionAsync(negocio.Id);

        return Ok(new
        {
            connected   = conn != null,
            locationName = conn?.LocationName,
            displayName  = conn?.DisplayName,
            connectedAt  = conn?.ConnectedAt
        });
    }

    // ─── GET /api/google/locations ────────────────────────────────────────────
    /// <summary>
    /// Lista los locales GBP disponibles.
    /// Se llama desde el frontend cuando hay múltiples locales para que el usuario elija.
    /// </summary>
    [HttpGet("locations")]
    [Authorize]
    public async Task<IActionResult> GetLocations()
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);

        var negocio = await GetNegocioForUserAsync(userId);
        if (negocio == null) return NotFound("Negocio no encontrado");

        var locations = await _gbp.GetLocationsAsync(negocio.Id);

        if (locations.Count == 0)
            return NotFound("No se encontraron locales GBP. Puede que la conexión haya expirado.");

        return Ok(locations.Select(l => new
        {
            locationName = l.LocationName,
            displayName  = l.DisplayName
        }));
    }

    // ─── POST /api/google/finalize ────────────────────────────────────────────
    /// <summary>
    /// Finaliza la conexión GBP con el local elegido por el usuario.
    /// Borra reseñas antiguas y lanza el sync inicial desde GBP.
    /// </summary>
    [HttpPost("finalize")]
    [Authorize]
    public async Task<IActionResult> FinalizeConnection([FromBody] FinalizeRequest request)
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);

        var negocio = await GetNegocioForUserAsync(userId);
        if (negocio == null) return NotFound("Negocio no encontrado");

        if (string.IsNullOrWhiteSpace(request.LocationName))
            return BadRequest("locationName es obligatorio");

        await _gbp.FinalizeConnectionAsync(negocio.Id, userId, request.LocationName, request.DisplayName ?? request.LocationName);

        _logger.LogInformation("[GoogleController] Conexión finalizada: local='{Name}', negocioId={Id}", request.DisplayName, negocio.Id);

        return Ok(new { ok = true, displayName = request.DisplayName });
    }

    // ─── DELETE /api/google/disconnect ────────────────────────────────────────
    /// <summary>
    /// Desconecta GBP: revoca el token OAuth, borra la conexión y elimina todas las reseñas.
    /// El usuario ha sido advertido en el frontend antes de llamar a este endpoint.
    /// </summary>
    [HttpDelete("disconnect")]
    [Authorize]
    public async Task<IActionResult> Disconnect()
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);

        var negocio = await GetNegocioForUserAsync(userId);
        if (negocio == null) return NotFound("Negocio no encontrado");

        await _gbp.DisconnectAsync(negocio.Id, userId);

        _logger.LogInformation("[GoogleController] GBP desconectado para userId={UserId}", userId);
        return Ok(new { ok = true });
    }

    // ─── Helper ───────────────────────────────────────────────────────────────

    private async Task<NegocioEntity?> GetNegocioForUserAsync(Guid userId)
    {
        var result = await _supabase.From<NegocioEntity>()
            .Where(n => n.IdUsuario == userId)
            .Limit(1)
            .Get();
        return result.Models.FirstOrDefault();
    }
}

public record FinalizeRequest(string LocationName, string? DisplayName);
