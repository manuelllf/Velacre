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

    public NegocioController(Supabase.Client supabase, ILogger<NegocioController> logger)
    {
        _supabase = supabase;
        _logger = logger;
    }

    [HttpGet("me")]
    public async Task<IActionResult> GetMyNegocio()
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        _logger.LogDebug("[NegocioController] GET /me — userId={UserId}", userId);

        var negocio = await _supabase.From<NegocioEntity>()
            .Where(n => n.IdUsuario == userId)
            .Single();

        if (negocio == null)
        {
            _logger.LogInformation("[NegocioController] Negocio no encontrado para userId={UserId}", userId);
            return NotFound();
        }

        _logger.LogDebug("[NegocioController] Negocio encontrado: {NegocioId}", negocio.Id);
        return Ok(negocio);
    }

    [HttpPost]
    public async Task<IActionResult> CreateNegocio([FromBody] CreateNegocioRequest request)
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        _logger.LogInformation("[NegocioController] POST / — userId={UserId}, nombre={Nombre}, cif={CIF}", userId, request.Nombre, request.CIF);

        var entity = new NegocioEntity
        {
            Codigo = "NEG" + Guid.NewGuid().ToString("N")[..7].ToUpper(),
            CIF = request.CIF,
            Nombre = request.Nombre,
            Email = request.Email,
            Telefono = request.Telefono,
            Descripcion = request.Descripcion,
            TonoPredefinido = request.TonoPredefinido ?? "Profesional",
            IdUsuario = userId,
            CreadoPor = userId,
            CreadoFecha = DateTimeOffset.UtcNow
        };

        try
        {
            var result = await _supabase.From<NegocioEntity>().Insert(entity);

            if (result.Models.Count == 0)
            {
                _logger.LogError("[NegocioController] Insert devolvió 0 modelos para userId={UserId}", userId);
                return StatusCode(500, "No se pudo crear el negocio.");
            }

            _logger.LogInformation("[NegocioController] Negocio creado: {NegocioId}", result.Models[0].Id);
            return Created("", result.Models[0]);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[NegocioController] Error al crear negocio para userId={UserId}", userId);
            return StatusCode(500, ex.Message);
        }
    }

    [HttpPut("me")]
    public async Task<IActionResult> UpdateNegocio([FromBody] UpdateNegocioRequest request)
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        _logger.LogInformation("[NegocioController] PUT /me — userId={UserId}", userId);

        var negocio = await _supabase.From<NegocioEntity>()
            .Where(n => n.IdUsuario == userId)
            .Single();

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
        negocio.ActualizadoPor = userId;
        negocio.ActualizadoFecha = DateTimeOffset.UtcNow;

        await _supabase.From<NegocioEntity>()
            .Where(n => n.Id == negocio.Id)
            .Update(negocio);

        _logger.LogInformation("[NegocioController] Negocio actualizado: {NegocioId}", negocio.Id);
        return Ok(negocio);
    }
}
