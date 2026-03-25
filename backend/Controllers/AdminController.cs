using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using backend.Models.Entities;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AdminController : ControllerBase
{
    private readonly Supabase.Client _supabase;
    private readonly ILogger<AdminController> _logger;
    private readonly Guid _adminUserId;

    public AdminController(Supabase.Client supabase, ILogger<AdminController> logger)
    {
        _supabase = supabase;
        _logger = logger;
        _adminUserId = Guid.Parse(Environment.GetEnvironmentVariable("ADMIN_USER_ID") ?? "00000000-0000-0000-0000-000000000000");
    }

    private bool IsAdmin() => Guid.Parse(User.FindFirst("sub")!.Value) == _adminUserId;

    [HttpGet("usuarios")]
    public async Task<IActionResult> GetUsuarios()
    {
        if (!IsAdmin()) return Forbid();

        var usuariosResult = await _supabase.From<UsuarioEntity>().Get();
        var negociosResult = await _supabase.From<NegocioEntity>().Get();

        var negocios = negociosResult.Models
            .Where(n => n.IdUsuario.HasValue)
            .GroupBy(n => n.IdUsuario!.Value)
            .ToDictionary(g => g.Key, g => g.First());

        var data = usuariosResult.Models
            .OrderBy(u => u.CreadoFecha)
            .Select(u => new
            {
                id = u.Id,
                nombre = u.Nombre,
                email = u.Email,
                activo = u.Activo,
                activoDesde = u.ActivoDesde,
                creadoFecha = u.CreadoFecha,
                plan = u.Plan,
                negocio = negocios.TryGetValue(u.Id, out var n) ? (object)new { id = n.Id, nombre = n.Nombre } : null
            });

        return Ok(data);
    }

    [HttpGet("stats")]
    public async Task<IActionResult> GetStats()
    {
        if (!IsAdmin()) return Forbid();

        var reviewsResult = await _supabase.From<ReviewEntity>().Get();
        var usuariosResult = await _supabase.From<UsuarioEntity>().Get();

        var totalReviews = reviewsResult.Models.Count;
        var proUsers = usuariosResult.Models.Count(u => u.Plan == "pro" && u.Activo);

        return Ok(new { totalReviews, proUsers });
    }

    [HttpPost("usuarios/{id}/activar")]
    public async Task<IActionResult> Activar(Guid id)
    {
        if (!IsAdmin()) return Forbid();

        var result = await _supabase.From<UsuarioEntity>().Where(u => u.Id == id).Limit(1).Get();
        var usuario = result.Models.FirstOrDefault();
        if (usuario == null) return NotFound();

        usuario.Activo = true;
        if (usuario.ActivoDesde == null) usuario.ActivoDesde = DateTimeOffset.UtcNow;

        await _supabase.From<UsuarioEntity>().Where(u => u.Id == id).Update(usuario);
        _logger.LogInformation("[AdminController] Usuario {UserId} activado", id);
        return Ok();
    }

    [HttpPost("usuarios/{id}/desactivar")]
    public async Task<IActionResult> Desactivar(Guid id)
    {
        if (!IsAdmin()) return Forbid();

        var result = await _supabase.From<UsuarioEntity>().Where(u => u.Id == id).Limit(1).Get();
        var usuario = result.Models.FirstOrDefault();
        if (usuario == null) return NotFound();

        usuario.Activo = false;

        await _supabase.From<UsuarioEntity>().Where(u => u.Id == id).Update(usuario);
        _logger.LogInformation("[AdminController] Usuario {UserId} desactivado", id);
        return Ok();
    }

    [HttpPost("usuarios/{id}/plan")]
    public async Task<IActionResult> CambiarPlan(Guid id, [FromBody] CambiarPlanRequest request)
    {
        if (!IsAdmin()) return Forbid();
        if (request.Plan != "basic" && request.Plan != "pro") return BadRequest("Plan inválido");

        var result = await _supabase.From<UsuarioEntity>().Where(u => u.Id == id).Limit(1).Get();
        var usuario = result.Models.FirstOrDefault();
        if (usuario == null) return NotFound();

        usuario.Plan = request.Plan;

        await _supabase.From<UsuarioEntity>().Where(u => u.Id == id).Update(usuario);
        _logger.LogInformation("[AdminController] Usuario {UserId} plan cambiado a {Plan}", id, request.Plan);
        return Ok();
    }

    // Único endpoint que permite cambiar el place_id de un negocio ya registrado
    [HttpPut("negocios/{negocioId}/place")]
    public async Task<IActionResult> SetPlaceId(Guid negocioId, [FromBody] SetPlaceIdRequest request)
    {
        if (!IsAdmin()) return Forbid();
        if (string.IsNullOrWhiteSpace(request.PlaceId)) return BadRequest("place_id no puede estar vacío.");

        var result = await _supabase.From<NegocioEntity>().Where(n => n.Id == negocioId).Limit(1).Get();
        var negocio = result.Models.FirstOrDefault();
        if (negocio == null) return NotFound();

        var old = negocio.PlaceId;
        negocio.PlaceId = request.PlaceId;
        negocio.ActualizadoFecha = DateTimeOffset.UtcNow;
        await _supabase.From<NegocioEntity>().Where(n => n.Id == negocioId).Update(negocio);

        _logger.LogInformation("[AdminController] place_id de negocio {NegocioId} cambiado: {Old} → {New}", negocioId, old, request.PlaceId);
        return Ok(new { negocioId, placeId = request.PlaceId });
    }
}

public record CambiarPlanRequest(string Plan);
public record SetPlaceIdRequest(string PlaceId);
