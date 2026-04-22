using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using backend.Infrastructure;
using backend.Interfaces;
using backend.Models.Entities;
using backend.Models.Requests;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class NegocioController : ControllerBase
{
    private readonly INegocioRepository _negocioRepo;
    private readonly IUsuarioRepository _usuarioRepo;
    private readonly ILogger<NegocioController> _logger;
    private readonly Guid _adminUserId;

    public NegocioController(INegocioRepository negocioRepo, IUsuarioRepository usuarioRepo, ILogger<NegocioController> logger)
    {
        _negocioRepo = negocioRepo;
        _usuarioRepo = usuarioRepo;
        _logger = logger;
        _adminUserId = Guid.Parse(Environment.GetEnvironmentVariable("ADMIN_USER_ID") ?? "00000000-0000-0000-0000-000000000000");
    }

    private bool IsAdmin() => User.GetUserId() == _adminUserId;

    [HttpGet("me")]
    public async Task<IActionResult> GetMyNegocio()
    {
        var userId = User.GetUserId();
        _logger.LogDebug("[NegocioController] GET /me — userId={UserId}", userId);

        // /me sigue devolviendo el primario (compat). Para multi-negocio usar GET / o GET /:id.
        var negocio = await _negocioRepo.GetByUserIdAsync(userId);

        if (negocio == null)
        {
            _logger.LogInformation("[NegocioController] Negocio primario no encontrado para userId={UserId}", userId);
            return NotFound();
        }

        _logger.LogDebug("[NegocioController] Negocio primario encontrado: {NegocioId}", negocio.Id);
        return Ok(ToDto(negocio));
    }

    /// <summary>
    /// Devuelve todos los negocios del usuario autenticado, ordenados por creación ASC.
    /// Por defecto solo devuelve activos. <c>?includeHidden=true</c> añade ocultos y deshabilitados
    /// (usado en Settings para ofrecer restaurar locales borrados).
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetAllMyNegocios([FromQuery] bool includeHidden = false)
    {
        var userId = User.GetUserId();
        var negocios = await _negocioRepo.GetAllByUserIdAsync(userId, includeHidden);
        _logger.LogDebug("[NegocioController] GET / — userId={UserId}, count={Count}, includeHidden={IncludeHidden}",
            userId, negocios.Count, includeHidden);
        return Ok(negocios.Select(ToDto));
    }

    /// <summary>
    /// Devuelve un negocio concreto por ID, validando ownership.
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetNegocioById(Guid id)
    {
        var userId = User.GetUserId();
        var negocio = await _negocioRepo.GetByIdAndUserIdAsync(id, userId);
        if (negocio == null) return NotFound();
        return Ok(ToDto(negocio));
    }

    /// <summary>
    /// Actualiza un negocio concreto por ID (validando ownership). Versión multi-local de PUT /me.
    /// </summary>
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateNegocioById(Guid id, [FromBody] UpdateNegocioRequest request)
    {
        var userId = User.GetUserId();
        var negocio = await _negocioRepo.GetByIdAndUserIdAsync(id, userId);
        if (negocio == null) return NotFound();

        negocio.Nombre = request.Nombre ?? negocio.Nombre;
        negocio.Email = request.Email ?? negocio.Email;
        negocio.Telefono = request.Telefono ?? negocio.Telefono;
        negocio.Descripcion = request.Descripcion ?? negocio.Descripcion;
        negocio.TonoPredefinido = request.TonoPredefinido ?? negocio.TonoPredefinido;
        if (request.PalabrasClave != null) negocio.PalabrasClave = request.PalabrasClave;

        if (request.PlaceId != null)
        {
            if (negocio.PlaceId != null && !IsAdmin())
                return Forbid();
            negocio.PlaceId = request.PlaceId;
        }

        negocio.ActualizadoPor = userId;
        negocio.ActualizadoFecha = DateTimeOffset.UtcNow;

        await _negocioRepo.UpdateAsync(negocio);
        _logger.LogInformation("[NegocioController] Negocio {NegocioId} actualizado", negocio.Id);
        return Ok(ToDto(negocio));
    }

    /// <summary>
    /// Oculta un negocio (soft delete). Preserva historial de reseñas/análisis para posible restore
    /// si el usuario más adelante re-añade el mismo place_id.
    /// Bloqueado si es el último negocio activo del usuario → 409 last_active (usar "Eliminar cuenta").
    /// </summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteNegocioById(Guid id)
    {
        var userId = User.GetUserId();
        var negocio = await _negocioRepo.GetByIdAndUserIdAsync(id, userId);
        if (negocio == null) return NotFound();

        if (negocio.Estado != "activo")
            return BadRequest(new { error = "already_hidden" });

        var activeCount = await _negocioRepo.CountByUserIdAsync(userId);
        if (activeCount <= 1)
            return Conflict(new { error = "last_active", message = "No puedes ocultar tu único local activo. Para eliminar la cuenta usa Zona de peligro." });

        await _negocioRepo.SoftDeleteAsync(id);
        _logger.LogInformation("[NegocioController] Negocio {NegocioId} ocultado (soft) por userId={UserId}", id, userId);
        return NoContent();
    }

    /// <summary>Restaura un negocio previamente oculto. Requiere slot libre (salvo Pro unlimited).</summary>
    [HttpPost("{id:guid}/restaurar")]
    public async Task<IActionResult> RestoreNegocio(Guid id)
    {
        var userId = User.GetUserId();
        var negocio = await _negocioRepo.GetByIdAndUserIdAsync(id, userId);
        if (negocio == null) return NotFound();
        if (negocio.Estado == "activo") return BadRequest(new { error = "already_active" });

        var usuario = await _usuarioRepo.GetByIdAsync(userId);
        if (usuario == null) return Unauthorized();

        var now = DateTimeOffset.UtcNow;
        var esProEfectivo = usuario.Plan == "pro" ||
            (usuario.ProOverride && (!usuario.ProOverrideHasta.HasValue || usuario.ProOverrideHasta.Value > now));

        if (!esProEfectivo)
        {
            var activeCount = await _negocioRepo.CountByUserIdAsync(userId);
            if (activeCount >= usuario.LocalesContratados)
                return StatusCode(403, new { error = "slot_limit_reached", contratados = usuario.LocalesContratados, requiredPlan = "pro" });
        }

        await _negocioRepo.RestoreAsync(id);
        _logger.LogInformation("[NegocioController] Negocio {NegocioId} restaurado por userId={UserId}", id, userId);
        var refreshed = await _negocioRepo.GetByIdAsync(id);
        return Ok(ToDto(refreshed!));
    }

    /// <summary>Marca un negocio como principal (transaccional, unset anterior + set nuevo).</summary>
    [HttpPost("{id:guid}/principal")]
    public async Task<IActionResult> SetPrincipal(Guid id)
    {
        var userId = User.GetUserId();
        var negocio = await _negocioRepo.GetByIdAndUserIdAsync(id, userId);
        if (negocio == null) return NotFound();
        if (negocio.Estado != "activo") return BadRequest(new { error = "not_active" });

        try
        {
            await _negocioRepo.SetPrincipalAsync(userId, id);
            _logger.LogInformation("[NegocioController] Negocio {NegocioId} marcado principal para userId={UserId}", id, userId);
            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[NegocioController] Error al marcar principal {NegocioId} userId={UserId}", id, userId);
            return StatusCode(500, new { error = "set_principal_failed" });
        }
    }

    [HttpPost]
    public async Task<IActionResult> CreateNegocio([FromBody] CreateNegocioRequest request)
    {
        var userId = User.GetUserId();
        _logger.LogInformation("[NegocioController] POST / — userId={UserId}, nombre={Nombre}", userId, request.Nombre);

        // Gating: Basic/Core usan locales_contratados (1 por defecto). Pro bypasa hasta que
        // existan variants de volumen en LS (momento en que el webhook subirá locales_contratados).
        var usuario = await _usuarioRepo.GetByIdAsync(userId);
        if (usuario == null) return Unauthorized();

        var now = DateTimeOffset.UtcNow;
        var esProEfectivo = usuario.Plan == "pro" ||
            (usuario.ProOverride && (!usuario.ProOverrideHasta.HasValue || usuario.ProOverrideHasta.Value > now));

        // Si el usuario envía place_id y ya tiene un negocio OCULTO con ese place_id,
        // ofrecemos restaurar en vez de crear uno nuevo (preserva historial).
        if (!string.IsNullOrEmpty(request.PlaceId))
        {
            var hidden = await _negocioRepo.GetHiddenByPlaceIdAsync(userId, request.PlaceId);
            if (hidden != null)
            {
                _logger.LogInformation("[NegocioController] place_id {PlaceId} ya existía oculto ({HiddenId}) para userId={UserId} — devolviendo 409 existe_oculto",
                    request.PlaceId, hidden.Id, userId);
                return Conflict(new { error = "existe_oculto", id = hidden.Id, nombre = hidden.Nombre });
            }
        }

        var codigo = "NEG" + Guid.NewGuid().ToString("N")[..7].ToUpper();

        try
        {
            var newId = await _negocioRepo.TryCreateAsync(
                userId,
                codigo,
                request.Nombre,
                request.Email,
                request.Telefono,
                request.Descripcion,
                request.TonoPredefinido ?? "Profesional",
                request.PalabrasClave,
                unlimited: esProEfectivo);

            var created = await _negocioRepo.GetByIdAsync(newId);
            if (created == null)
            {
                _logger.LogError("[NegocioController] No se encontró el negocio {NewId} tras TryCreateAsync", newId);
                return StatusCode(500, "No se pudo crear el negocio.");
            }

            _logger.LogInformation("[NegocioController] Negocio creado: {NegocioId}", created.Id);
            return Created("", ToDto(created));
        }
        catch (SlotLimitReachedException)
        {
            var contratados = usuario.LocalesContratados;
            _logger.LogWarning("[NegocioController] slot_limit_reached userId={UserId} contratados={Contratados} plan={Plan}",
                userId, contratados, usuario.Plan);
            return StatusCode(403, new
            {
                error = "slot_limit_reached",
                contratados,
                requiredPlan = "pro",
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[NegocioController] Error al crear negocio para userId={UserId}", userId);
            throw;
        }
    }

    [HttpPut("me")]
    public async Task<IActionResult> UpdateNegocio([FromBody] UpdateNegocioRequest request)
    {
        var userId = User.GetUserId();
        _logger.LogInformation("[NegocioController] PUT /me — userId={UserId}", userId);

        var negocio = await _negocioRepo.GetByUserIdAsync(userId);

        if (negocio == null)
        {
            _logger.LogWarning("[NegocioController] Negocio no encontrado para actualizar, userId={UserId}", userId);
            return NotFound();
        }

        negocio.Nombre = request.Nombre ?? negocio.Nombre;
        negocio.Email = request.Email ?? negocio.Email;
        negocio.Telefono = request.Telefono ?? negocio.Telefono;
        negocio.Descripcion = request.Descripcion ?? negocio.Descripcion;
        negocio.TonoPredefinido = request.TonoPredefinido ?? negocio.TonoPredefinido;
        if (request.PalabrasClave != null) negocio.PalabrasClave = request.PalabrasClave;

        if (request.PlaceId != null)
        {
            if (negocio.PlaceId != null && !IsAdmin())
            {
                _logger.LogWarning("[NegocioController] Usuario {UserId} intentó cambiar place_id bloqueado (actual={Current})", userId, negocio.PlaceId);
                return Forbid();
            }
            negocio.PlaceId = request.PlaceId;
        }

        negocio.ActualizadoPor = userId;
        negocio.ActualizadoFecha = DateTimeOffset.UtcNow;

        await _negocioRepo.UpdateAsync(negocio);

        _logger.LogInformation("[NegocioController] Negocio actualizado: {NegocioId}", negocio.Id);
        return Ok(ToDto(negocio));
    }

    private static object ToDto(NegocioEntity n) => new
    {
        id = n.Id,
        codigo = n.Codigo,
        nombre = n.Nombre,
        email = n.Email,
        telefono = n.Telefono,
        descripcion = n.Descripcion,
        tonopredefinido = n.TonoPredefinido,
        placeId = n.PlaceId,
        palabrasClave = n.PalabrasClave ?? Array.Empty<string>(),
        estado = n.Estado,
        esPrincipal = n.EsPrincipal,
    };
}
