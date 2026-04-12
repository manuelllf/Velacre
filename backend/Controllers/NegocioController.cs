using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using backend.Models.Entities;
using backend.Models.Requests;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class NegocioController : ControllerBase
{
    private readonly Supabase.Client _supabase;
    private readonly ILogger<NegocioController> _logger;

    private readonly Guid _adminUserId;

    public NegocioController(Supabase.Client supabase, ILogger<NegocioController> logger)
    {
        _supabase = supabase;
        _logger = logger;
        _adminUserId = Guid.Parse(Environment.GetEnvironmentVariable("ADMIN_USER_ID") ?? "00000000-0000-0000-0000-000000000000");
    }

    private bool IsAdmin() => Guid.Parse(User.FindFirst("sub")!.Value) == _adminUserId;

    [HttpGet("me")]
    public async Task<IActionResult> GetMyNegocio()
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        _logger.LogDebug("[NegocioController] GET /me — userId={UserId}", userId);

        var result = await _supabase.From<NegocioEntity>()
            .Where(n => n.IdUsuario == userId)
            .Limit(1)
            .Get();

        var negocio = result.Models.FirstOrDefault();

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
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
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
            await _supabase.From<NegocioEntity>().Insert(entity);

            // Supabase a veces devuelve Models vacío aunque el INSERT fue correcto — hacemos GET para obtener el registro
            var fetched = await _supabase.From<NegocioEntity>()
                .Where(n => n.IdUsuario == userId)
                .Limit(1)
                .Get();

            var created = fetched.Models.FirstOrDefault();
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
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        _logger.LogInformation("[NegocioController] PUT /me — userId={UserId}", userId);

        var updateResult = await _supabase.From<NegocioEntity>()
            .Where(n => n.IdUsuario == userId)
            .Limit(1)
            .Get();

        var negocio = updateResult.Models.FirstOrDefault();

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

        // place_id queda bloqueado tras el registro inicial.
        // Solo se puede cambiar si aún no está establecido (onboarding) o si el usuario es admin.
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

        await _supabase.From<NegocioEntity>()
            .Where(n => n.Id == negocio.Id)
            .Update(negocio);

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
