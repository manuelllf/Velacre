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
    private readonly ILogger<NegocioController> _logger;
    private readonly Guid _adminUserId;

    public NegocioController(INegocioRepository negocioRepo, ILogger<NegocioController> logger)
    {
        _negocioRepo = negocioRepo;
        _logger = logger;
        _adminUserId = Guid.Parse(Environment.GetEnvironmentVariable("ADMIN_USER_ID") ?? "00000000-0000-0000-0000-000000000000");
    }

    private bool IsAdmin() => User.GetUserId() == _adminUserId;

    [HttpGet("me")]
    public async Task<IActionResult> GetMyNegocio()
    {
        var userId = User.GetUserId();
        _logger.LogDebug("[NegocioController] GET /me — userId={UserId}", userId);

        var negocio = await _negocioRepo.GetByUserIdAsync(userId);

        if (negocio == null)
        {
            _logger.LogInformation("[NegocioController] Negocio no encontrado para userId={UserId}", userId);
            return NotFound();
        }

        _logger.LogDebug("[NegocioController] Negocio encontrado: {NegocioId}", negocio.Id);
        return Ok(ToDto(negocio));
    }

    [HttpPost]
    public async Task<IActionResult> CreateNegocio([FromBody] CreateNegocioRequest request)
    {
        var userId = User.GetUserId();
        _logger.LogInformation("[NegocioController] POST / — userId={UserId}, nombre={Nombre}", userId, request.Nombre);

        var entity = new NegocioEntity
        {
            Codigo = "NEG" + Guid.NewGuid().ToString("N")[..7].ToUpper(),
            Nombre = request.Nombre,
            Email = request.Email,
            Telefono = request.Telefono,
            Descripcion = request.Descripcion,
            TonoPredefinido = request.TonoPredefinido ?? "Profesional",
            PalabrasClave = request.PalabrasClave,
            IdUsuario = userId,
            CreadoPor = userId,
            CreadoFecha = DateTimeOffset.UtcNow
        };

        try
        {
            await _negocioRepo.InsertAsync(entity);

            var created = await _negocioRepo.GetByUserIdAsync(userId);
            if (created == null)
            {
                _logger.LogError("[NegocioController] No se encontró el negocio tras INSERT para userId={UserId}", userId);
                return StatusCode(500, "No se pudo crear el negocio.");
            }

            _logger.LogInformation("[NegocioController] Negocio creado: {NegocioId}", created.Id);
            return Created("", ToDto(created));
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
        palabrasClave = n.PalabrasClave ?? Array.Empty<string>()
    };
}
