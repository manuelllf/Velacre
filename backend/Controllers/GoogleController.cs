using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using backend.Infrastructure;
using backend.Interfaces;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class GoogleController : ControllerBase
{
    private readonly IGoogleBusinessService _gbp;
    private readonly INegocioRepository _negocioRepo;
    private readonly ILogger<GoogleController> _logger;

    public GoogleController(IGoogleBusinessService gbp, INegocioRepository negocioRepo, ILogger<GoogleController> logger)
    {
        _gbp = gbp;
        _negocioRepo = negocioRepo;
        _logger = logger;
    }

    [HttpGet("auth-url")]
    [Authorize]
    public async Task<IActionResult> GetAuthUrl([FromQuery] string negocioId, [FromQuery] string returnTo = "onboarding")
    {
        var userId = User.GetUserId();

        if (!Guid.TryParse(negocioId, out var negocioGuid))
            return BadRequest("negocioId inválido");

        var negocio = await _negocioRepo.GetByIdAndUserIdAsync(negocioGuid, userId);
        if (negocio == null)
            return NotFound("Negocio no encontrado");

        var url = _gbp.GenerateAuthUrl(negocioGuid, userId, returnTo);
        _logger.LogInformation("[GoogleController] Auth URL generada para userId={UserId}, negocioId={NegocioId}", userId, negocioGuid);

        return Ok(new { url });
    }

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

    [HttpGet("status")]
    [Authorize]
    public async Task<IActionResult> GetStatus()
    {
        var userId = User.GetUserId();

        var negocio = await _negocioRepo.ResolveScopedAsync(HttpContext, userId);
        if (negocio == null) return NotFound("Negocio no encontrado");

        var conn = await _gbp.GetConnectionAsync(negocio.Id);

        return Ok(new
        {
            connected    = conn != null,
            locationName = conn?.LocationName,
            displayName  = conn?.DisplayName,
            connectedAt  = conn?.ConnectedAt
        });
    }

    [HttpGet("locations")]
    [Authorize]
    public async Task<IActionResult> GetLocations()
    {
        var userId = User.GetUserId();

        var negocio = await _negocioRepo.ResolveScopedAsync(HttpContext, userId);
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

    [HttpPost("finalize")]
    [Authorize]
    public async Task<IActionResult> FinalizeConnection([FromBody] FinalizeRequest request)
    {
        var userId = User.GetUserId();

        var negocio = await _negocioRepo.ResolveScopedAsync(HttpContext, userId);
        if (negocio == null) return NotFound("Negocio no encontrado");

        if (string.IsNullOrWhiteSpace(request.LocationName))
            return BadRequest("locationName es obligatorio");

        await _gbp.FinalizeConnectionAsync(negocio.Id, userId, request.LocationName, request.DisplayName ?? request.LocationName);

        _logger.LogInformation("[GoogleController] Conexión finalizada: local='{Name}', negocioId={Id}", request.DisplayName, negocio.Id);

        return Ok(new { ok = true, displayName = request.DisplayName });
    }

    [HttpDelete("disconnect")]
    [Authorize]
    public async Task<IActionResult> Disconnect()
    {
        var userId = User.GetUserId();

        var negocio = await _negocioRepo.ResolveScopedAsync(HttpContext, userId);
        if (negocio == null) return NotFound("Negocio no encontrado");

        await _gbp.DisconnectAsync(negocio.Id, userId);

        _logger.LogInformation("[GoogleController] GBP desconectado para userId={UserId}", userId);
        return Ok(new { ok = true });
    }
}

public record FinalizeRequest(string LocationName, string? DisplayName);
