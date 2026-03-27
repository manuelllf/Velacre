using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using backend.Models.Entities;
using backend.Models.Requests;
using backend.Services;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UsuarioController : ControllerBase
{
    private readonly Supabase.Client _supabase;
    private readonly ILogger<UsuarioController> _logger;
    private readonly Guid _adminUserId;
    private readonly EmailService _email;
    private readonly HttpClient _http;

    public UsuarioController(Supabase.Client supabase, ILogger<UsuarioController> logger, EmailService email, IHttpClientFactory httpClientFactory)
    {
        _supabase = supabase;
        _logger = logger;
        _adminUserId = Guid.Parse(Environment.GetEnvironmentVariable("ADMIN_USER_ID") ?? "00000000-0000-0000-0000-000000000000");
        _email = email;
        _http = httpClientFactory.CreateClient();
    }

    [HttpGet("me")]
    public async Task<IActionResult> GetMe()
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        var result = await _supabase.From<UsuarioEntity>()
            .Where(u => u.Id == userId)
            .Limit(1)
            .Get();
        var usuario = result.Models.FirstOrDefault();
        if (usuario == null) return NotFound();
        var isAdmin = userId == _adminUserId || usuario.Rol == "admin";
        var rolEfectivo = isAdmin ? "admin" : usuario.Rol;

        // Pro override: si está activo y no ha caducado, el plan efectivo es "pro"
        var overrideActivo = usuario.ProOverride &&
            (usuario.ProOverrideHasta == null || usuario.ProOverrideHasta > DateTimeOffset.UtcNow);
        var planEfectivo = overrideActivo ? "pro" : usuario.Plan;

        return Ok(new
        {
            id = usuario.Id,
            nombre = usuario.Nombre,
            telefono = usuario.Telefono,
            activo = usuario.Activo,
            activoDesde = usuario.ActivoDesde,
            isAdmin,
            rol = rolEfectivo,
            plan = planEfectivo,
            lsCustomerPortal = usuario.LsCustomerPortal
        });
    }

    [HttpPut("me")]
    public async Task<IActionResult> UpdateMe([FromBody] CreateUsuarioRequest request)
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        var result = await _supabase.From<UsuarioEntity>()
            .Where(u => u.Id == userId)
            .Limit(1)
            .Get();
        var usuario = result.Models.FirstOrDefault();
        if (usuario == null) return NotFound();

        await _supabase.From<UsuarioEntity>()
            .Where(u => u.Id == userId)
            .Set(u => u.Nombre,           request.Nombre ?? usuario.Nombre ?? "")
            .Set(u => u.ActualizadoPor,   userId)
            .Set(u => u.ActualizadoFecha, DateTimeOffset.UtcNow)
            .Update();
        _logger.LogInformation("[UsuarioController] Perfil actualizado para userId={UserId}", userId);
        return Ok(new { id = usuario.Id, nombre = usuario.Nombre, telefono = usuario.Telefono });
    }

    [HttpDelete("me")]
    public async Task<IActionResult> DeleteMe()
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);

        // Fetch the user to get the LS subscription ID (if any)
        var result = await _supabase.From<UsuarioEntity>().Where(u => u.Id == userId).Limit(1).Get();
        var usuario = result.Models.FirstOrDefault();

        // Cancel Lemon Squeezy subscription if active
        if (!string.IsNullOrEmpty(usuario?.LsSubscriptionId))
        {
            try
            {
                var lsKey = Environment.GetEnvironmentVariable("LEMONSQUEEZY_API_KEY");
                var req = new HttpRequestMessage(HttpMethod.Delete, $"https://api.lemonsqueezy.com/v1/subscriptions/{usuario.LsSubscriptionId}");
                req.Headers.Add("Authorization", $"Bearer {lsKey}");
                req.Headers.Add("Accept", "application/vnd.api+json");
                var resp = await _http.SendAsync(req);
                _logger.LogInformation("[UsuarioController] Cancelada sub LS {SubId}: HTTP {Status}", usuario.LsSubscriptionId, (int)resp.StatusCode);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[UsuarioController] Error cancelando sub LS para userId={UserId}", userId);
                // Continue with account deletion even if LS cancel fails
            }
        }

        // Anonymize personal data — keep the row for billing history
        await _supabase.From<UsuarioEntity>()
            .Where(u => u.Id == userId)
            .Set(u => u.Nombre, "[eliminado]")
            .Set(u => u.Email, (string?)null)
            .Set(u => u.Telefono, (string?)null)
            .Set(u => u.Activo, false)
            .Set(u => u.Plan, "basic")
            .Set(u => u.ActualizadoFecha, DateTimeOffset.UtcNow)
            .Update();

        // Remove from auth.users via Supabase Admin REST API (requires service role key)
        try
        {
            var supabaseUrl = Environment.GetEnvironmentVariable("SUPABASE_URL")?.TrimEnd('/');
            var serviceKey  = Environment.GetEnvironmentVariable("SUPABASE_SERVICE_KEY");
            if (!string.IsNullOrEmpty(supabaseUrl) && !string.IsNullOrEmpty(serviceKey))
            {
                var req = new HttpRequestMessage(HttpMethod.Delete, $"{supabaseUrl}/auth/v1/admin/users/{userId}");
                req.Headers.Add("Authorization", $"Bearer {serviceKey}");
                req.Headers.Add("apikey", serviceKey);
                var resp = await _http.SendAsync(req);
                _logger.LogInformation("[UsuarioController] Delete auth.users HTTP {Status} para userId={UserId}", (int)resp.StatusCode, userId);
            }
            else
            {
                _logger.LogWarning("[UsuarioController] SUPABASE_SERVICE_KEY no configurado — auth.users no eliminado para userId={UserId}", userId);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[UsuarioController] No se pudo eliminar auth.users para userId={UserId}", userId);
            // Still return OK — data is already anonymized
        }

        _logger.LogInformation("[UsuarioController] Cuenta anonimizada + auth eliminada para userId={UserId}", userId);
        return Ok();
    }

    [HttpPost]
    public async Task<IActionResult> CreateProfile([FromBody] CreateUsuarioRequest request)
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        var email = User.FindFirst("email")?.Value;
        _logger.LogInformation("[UsuarioController] POST / — userId={UserId}, nombre={Nombre}", userId, request.Nombre);

        var entity = new UsuarioEntity
        {
            Id = userId,
            Nombre = request.Nombre,
            Telefono = request.Telefono,
            Email = email,
            Activo = true,
            ActivoDesde = DateTimeOffset.UtcNow,
            Plan = "basic",
            CreadoPor = userId,
            CreadoFecha = DateTimeOffset.UtcNow
        };

        try
        {
            var result = await _supabase.From<UsuarioEntity>().Insert(entity);

            if (result.Models.Count == 0)
            {
                _logger.LogWarning("[UsuarioController] Insert devolvió 0 modelos para userId={UserId} (puede ser normal en Supabase)", userId);
            }

            _logger.LogInformation("[UsuarioController] Perfil creado para userId={UserId}", userId);

            // Fire-and-forget welcome email
            if (!string.IsNullOrEmpty(email))
                _ = _email.SendWelcomeAsync(email, request.Nombre ?? "");

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[UsuarioController] Error al crear perfil para userId={UserId}", userId);
            return StatusCode(500, ex.Message);
        }
    }
}
