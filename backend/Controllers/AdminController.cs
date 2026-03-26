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

    private async Task<bool> IsAdminAsync()
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        if (userId == _adminUserId) return true;
        var r = await _supabase.From<UsuarioEntity>().Where(u => u.Id == userId).Limit(1).Get();
        return r.Models.FirstOrDefault()?.Rol == "admin";
    }

    // ─── Usuarios ────────────────────────────────────────────────────────────

    [HttpGet("usuarios")]
    public async Task<IActionResult> GetUsuarios()
    {
        if (!await IsAdminAsync()) return Forbid();

        var usuariosResult = await _supabase.From<UsuarioEntity>().Get();
        var negociosResult = await _supabase.From<NegocioEntity>().Get();

        var negocios = negociosResult.Models
            .Where(n => n.IdUsuario.HasValue)
            .GroupBy(n => n.IdUsuario!.Value)
            .ToDictionary(g => g.Key, g => g.First());

        var now = DateTimeOffset.UtcNow;

        var data = usuariosResult.Models
            .OrderBy(u => u.CreadoFecha)
            .Select(u =>
            {
                var estadoEfectivo = u.Estado;
                if (u.Estado == "prueba" && u.PruebaHasta.HasValue && u.PruebaHasta.Value < now)
                    estadoEfectivo = "prueba_expirada";

                var proEfectivo = u.Plan == "pro" ||
                    (u.ProOverride && (!u.ProOverrideHasta.HasValue || u.ProOverrideHasta.Value > now));

                return new
                {
                    id               = u.Id,
                    nombre           = u.Nombre,
                    email            = u.Email,
                    activo           = u.Activo,
                    activoDesde      = u.ActivoDesde,
                    creadoFecha      = u.CreadoFecha,
                    plan             = u.Plan,
                    estado           = estadoEfectivo,
                    pruebaHasta      = u.PruebaHasta,
                    proOverride      = u.ProOverride,
                    proOverrideHasta = u.ProOverrideHasta,
                    proEfectivo,
                    notasAdmin       = u.NotasAdmin,
                    rol              = u.Rol,
                    negocio = negocios.TryGetValue(u.Id, out var n)
                        ? (object)new { id = n.Id, nombre = n.Nombre, placeId = n.PlaceId }
                        : null,
                };
            });

        return Ok(data);
    }

    // ─── Cambiar estado ───────────────────────────────────────────────────────

    [HttpPost("usuarios/{id}/estado")]
    public async Task<IActionResult> CambiarEstado(Guid id, [FromBody] CambiarEstadoRequest request)
    {
        if (!await IsAdminAsync()) return Forbid();
        if (request.Estado != "activo" && request.Estado != "baneado" && request.Estado != "prueba")
            return BadRequest("Estado inválido. Valores: activo, baneado, prueba");

        var result = await _supabase.From<UsuarioEntity>().Where(u => u.Id == id).Limit(1).Get();
        var usuario = result.Models.FirstOrDefault();
        if (usuario == null) return NotFound();

        var now = DateTimeOffset.UtcNow;
        usuario.Estado = request.Estado;
        usuario.Activo = request.Estado == "activo";

        if (request.Estado == "activo" && usuario.ActivoDesde == null)
            usuario.ActivoDesde = now;

        if (request.Estado == "prueba")
        {
            var dias = request.DiasPrueba ?? 14;
            usuario.PruebaHasta = now.AddDays(dias);
            if (usuario.ActivoDesde == null) usuario.ActivoDesde = now;
        }

        await _supabase.From<UsuarioEntity>().Where(u => u.Id == id).Update(usuario);
        _logger.LogInformation("[AdminController] Usuario {UserId} estado → {Estado}", id, request.Estado);
        return Ok(new { estado = usuario.Estado, pruebaHasta = usuario.PruebaHasta });
    }

    // ─── Pro Override ─────────────────────────────────────────────────────────

    [HttpPost("usuarios/{id}/pro-override")]
    public async Task<IActionResult> ProOverride(Guid id, [FromBody] ProOverrideRequest request)
    {
        if (!await IsAdminAsync()) return Forbid();

        var result = await _supabase.From<UsuarioEntity>().Where(u => u.Id == id).Limit(1).Get();
        var usuario = result.Models.FirstOrDefault();
        if (usuario == null) return NotFound();

        usuario.ProOverride = request.Activo;
        usuario.ProOverrideHasta = request.Activo && request.DiasExpira.HasValue
            ? DateTimeOffset.UtcNow.AddDays(request.DiasExpira.Value)
            : (DateTimeOffset?)null;

        await _supabase.From<UsuarioEntity>().Where(u => u.Id == id).Update(usuario);
        _logger.LogInformation("[AdminController] Usuario {UserId} ProOverride={Override}", id, request.Activo);
        return Ok(new { proOverride = usuario.ProOverride, proOverrideHasta = usuario.ProOverrideHasta });
    }

    // ─── Notas admin ──────────────────────────────────────────────────────────

    [HttpPut("usuarios/{id}/notas")]
    public async Task<IActionResult> ActualizarNotas(Guid id, [FromBody] NotasAdminRequest request)
    {
        if (!await IsAdminAsync()) return Forbid();

        var result = await _supabase.From<UsuarioEntity>().Where(u => u.Id == id).Limit(1).Get();
        var usuario = result.Models.FirstOrDefault();
        if (usuario == null) return NotFound();

        usuario.NotasAdmin = request.Notas;
        await _supabase.From<UsuarioEntity>().Where(u => u.Id == id).Update(usuario);
        return Ok();
    }

    // ─── Plan ─────────────────────────────────────────────────────────────────

    [HttpPost("usuarios/{id}/plan")]
    public async Task<IActionResult> CambiarPlan(Guid id, [FromBody] CambiarPlanRequest request)
    {
        if (!await IsAdminAsync()) return Forbid();
        if (request.Plan != "basic" && request.Plan != "core" && request.Plan != "pro")
            return BadRequest("Plan inválido. Valores: basic, core, pro");

        var result = await _supabase.From<UsuarioEntity>().Where(u => u.Id == id).Limit(1).Get();
        var usuario = result.Models.FirstOrDefault();
        if (usuario == null) return NotFound();

        usuario.Plan = request.Plan;
        await _supabase.From<UsuarioEntity>().Where(u => u.Id == id).Update(usuario);
        _logger.LogInformation("[AdminController] Usuario {UserId} plan → {Plan}", id, request.Plan);
        return Ok();
    }

    // ─── Place ID ─────────────────────────────────────────────────────────────

    [HttpPut("negocios/{negocioId}/place")]
    public async Task<IActionResult> SetPlaceId(Guid negocioId, [FromBody] SetPlaceIdRequest request)
    {
        if (!await IsAdminAsync()) return Forbid();
        if (string.IsNullOrWhiteSpace(request.PlaceId)) return BadRequest("place_id no puede estar vacío.");

        try
        {
            var result = await _supabase.From<NegocioEntity>().Where(n => n.Id == negocioId).Limit(1).Get();
            var negocio = result.Models.FirstOrDefault();
            if (negocio == null) return NotFound($"Negocio {negocioId} no encontrado");

            var old = negocio.PlaceId;
            negocio.PlaceId = request.PlaceId;
            negocio.ActualizadoFecha = DateTimeOffset.UtcNow;
            await _supabase.From<NegocioEntity>().Update(negocio);

            _logger.LogInformation("[AdminController] SetPlaceId: negocio {NegocioId} {Old} → {New}", negocioId, old, request.PlaceId);
            return Ok(new { negocioId, old, placeId = request.PlaceId });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AdminController] SetPlaceId error negocio {NegocioId}", negocioId);
            return StatusCode(500, ex.Message);
        }
    }

    // ─── Legacy compat ────────────────────────────────────────────────────────

    [HttpPost("usuarios/{id}/activar")]
    public async Task<IActionResult> Activar(Guid id)
    {
        if (!await IsAdminAsync()) return Forbid();
        return await CambiarEstado(id, new CambiarEstadoRequest("activo", null));
    }

    [HttpPost("usuarios/{id}/desactivar")]
    public async Task<IActionResult> Desactivar(Guid id)
    {
        if (!await IsAdminAsync()) return Forbid();
        return await CambiarEstado(id, new CambiarEstadoRequest("baneado", null));
    }

    // ─── Asignar Rol ──────────────────────────────────────────────────────────

    [HttpPut("usuarios/{id}/rol")]
    public async Task<IActionResult> AsignarRol(Guid id, [FromBody] AsignarRolRequest request)
    {
        if (!await IsAdminAsync()) return Forbid();
        if (request.Rol != "cliente" && request.Rol != "admin")
            return BadRequest("Rol inválido. Valores: cliente, admin");

        var result = await _supabase.From<UsuarioEntity>().Where(u => u.Id == id).Limit(1).Get();
        var usuario = result.Models.FirstOrDefault();
        if (usuario == null) return NotFound();

        usuario.Rol = request.Rol;
        await _supabase.From<UsuarioEntity>().Where(u => u.Id == id).Update(usuario);
        _logger.LogInformation("[AdminController] Usuario {UserId} rol → {Rol}", id, request.Rol);
        return Ok(new { rol = request.Rol });
    }
}

// ─── Request records ─────────────────────────────────────────────────────────

public record CambiarEstadoRequest(string Estado, int? DiasPrueba);
public record ProOverrideRequest(bool Activo, int? DiasExpira);
public record NotasAdminRequest(string? Notas);
public record CambiarPlanRequest(string Plan);
public record SetPlaceIdRequest(string PlaceId);
public record AsignarRolRequest(string Rol);
