using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using backend.Infrastructure;
using backend.Interfaces;
using backend.Models.Entities;
using backend.Models.Requests;
using backend.Services;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UsuarioController : ControllerBase
{
    private readonly IUsuarioRepository _usuarioRepo;
    private readonly INegocioRepository _negocioRepo;
    private readonly IReviewRepository _reviewRepo;
    private readonly ILogger<UsuarioController> _logger;
    private readonly Guid _adminUserId;
    private readonly EmailService _email;
    private readonly HttpClient _http;

    public UsuarioController(
        IUsuarioRepository usuarioRepo,
        INegocioRepository negocioRepo,
        IReviewRepository reviewRepo,
        ILogger<UsuarioController> logger,
        EmailService email,
        IHttpClientFactory httpClientFactory)
    {
        _usuarioRepo = usuarioRepo;
        _negocioRepo = negocioRepo;
        _reviewRepo = reviewRepo;
        _logger = logger;
        _adminUserId = Guid.Parse(Environment.GetEnvironmentVariable("ADMIN_USER_ID") ?? "00000000-0000-0000-0000-000000000000");
        _email = email;
        _http = httpClientFactory.CreateClient();
    }

    [HttpGet("me")]
    public async Task<IActionResult> GetMe()
    {
        var userId = User.GetUserId();
        var usuario = await _usuarioRepo.GetByIdAsync(userId);
        if (usuario == null) return NotFound();
        var isAdmin = userId == _adminUserId || usuario.Rol == "admin";
        var rolEfectivo = isAdmin ? "admin" : usuario.Rol;

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
            plan             = planEfectivo,
            lsCustomerPortal = usuario.LsCustomerPortal,
            lsSubscriptionId = usuario.LsSubscriptionId,
            lsStatus         = usuario.LsStatus,
            lsRenewsAt       = usuario.LsRenewsAt,
            lsEndsAt         = usuario.LsEndsAt,
            respuestasIaMes  = usuario.RespuestasIaMes,
        });
    }

    [HttpPut("me")]
    public async Task<IActionResult> UpdateMe([FromBody] CreateUsuarioRequest request)
    {
        var userId = User.GetUserId();
        var usuario = await _usuarioRepo.GetByIdAsync(userId);
        if (usuario == null) return NotFound();

        await _usuarioRepo.UpdateNombreAsync(userId, request.Nombre ?? usuario.Nombre ?? "");
        _logger.LogInformation("[UsuarioController] Perfil actualizado para userId={UserId}", userId);
        return Ok(new { id = usuario.Id, nombre = usuario.Nombre, telefono = usuario.Telefono });
    }

    [HttpDelete("me")]
    public async Task<IActionResult> DeleteMe()
    {
        var userId = User.GetUserId();

        var usuario = await _usuarioRepo.GetByIdAsync(userId);

        // 1. Cancel Lemon Squeezy subscription if active
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
            }
        }

        // 2. Borrado atómico vía RPC
        bool rpcOk = false;
        try
        {
            await _usuarioRepo.DeleteUserCascadeAsync(userId);
            rpcOk = true;
            _logger.LogInformation("[UsuarioController] delete_user_cascade OK para userId={UserId}", userId);
        }
        catch (Exception rpcEx)
        {
            _logger.LogWarning(rpcEx, "[UsuarioController] delete_user_cascade RPC falló, usando fallback manual");
        }

        if (!rpcOk)
        {
            // Fallback manual (no transaccional) — multi-negocio: iterar todos los del usuario.
            var negocios = await _negocioRepo.GetAllByUserIdAsync(userId);
            foreach (var negocio in negocios)
            {
                await _reviewRepo.DeleteByNegocioIdAsync(negocio.Id);
                _logger.LogInformation("[UsuarioController] [fallback] Reviews eliminadas para negocioId={NegocioId}", negocio.Id);
            }
            await _negocioRepo.DeleteByUserIdAsync(userId);
            _logger.LogInformation("[UsuarioController] [fallback] Negocio(s) eliminado(s) para userId={UserId}", userId);

            await _usuarioRepo.AnonymizeAsync(userId);
        }

        // Remove from auth.users
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
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[UsuarioController] No se pudo eliminar auth.users para userId={UserId}", userId);
        }

        _logger.LogInformation("[UsuarioController] Cuenta anonimizada + auth eliminada para userId={UserId} (modo={Mode})", userId, rpcOk ? "rpc" : "fallback");
        return Ok();
    }

    [HttpPost]
    public async Task<IActionResult> CreateProfile([FromBody] CreateUsuarioRequest request)
    {
        var userId = User.GetUserId();
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
            await _usuarioRepo.InsertAsync(entity);
            _logger.LogInformation("[UsuarioController] Perfil creado para userId={UserId}", userId);

            if (!string.IsNullOrEmpty(email))
                FireAndForget.Run(_email.SendWelcomeAsync(email, request.Nombre ?? ""), _logger, "Welcome");

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[UsuarioController] Error al crear perfil para userId={UserId}", userId);
            throw;
        }
    }

    /// <summary>
    /// Heartbeat de acceso a la app. Se llama desde /dashboard y /inicio al
    /// montar. Con rate-limit soft: si el último inicio fue hace menos de 1h,
    /// no incrementa (evita inflar el contador por navegación SPA rápida).
    /// Devuelve 204 siempre para no bloquear el render del cliente.
    /// </summary>
    [HttpPost("me/heartbeat")]
    public async Task<IActionResult> Heartbeat()
    {
        var userId = User.GetUserId();
        var user = await _usuarioRepo.GetByIdAsync(userId);
        if (user == null) return NoContent();

        var now = DateTimeOffset.UtcNow;
        var debeIncrementar = user.UltimoInicioSesion == null
            || (now - user.UltimoInicioSesion.Value) > TimeSpan.FromHours(1);

        if (debeIncrementar)
        {
            try { await _usuarioRepo.IncrementInicioSesionAsync(userId, now); }
            catch (Exception ex)
            {
                // No bloqueamos la app por fallo en tracking. Log + swallow.
                _logger.LogWarning(ex, "[UsuarioController] Heartbeat fallo para userId={UserId}", userId);
            }
        }
        return NoContent();
    }
}
