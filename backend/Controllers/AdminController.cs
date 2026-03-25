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

    // ─── Usuarios ────────────────────────────────────────────────────────────

    [HttpGet("usuarios")]
    public async Task<IActionResult> GetUsuarios()
    {
        if (!IsAdmin()) return Forbid();

        var usuariosResult = await _supabase.From<UsuarioEntity>().Get();
        var negociosResult = await _supabase.From<NegocioEntity>().Get();
        var costosResult   = await _supabase.From<CostoMesEntity>().Get();

        var negocios = negociosResult.Models
            .Where(n => n.IdUsuario.HasValue)
            .GroupBy(n => n.IdUsuario!.Value)
            .ToDictionary(g => g.Key, g => g.First());

        var now = DateTimeOffset.UtcNow;

        var data = usuariosResult.Models
            .OrderBy(u => u.CreadoFecha)
            .Select(u =>
            {
                // Calcular estado efectivo (prueba expirada → baneado a efectos funcionales)
                var estadoEfectivo = u.Estado;
                if (u.Estado == "prueba" && u.PruebaHasta.HasValue && u.PruebaHasta.Value < now)
                    estadoEfectivo = "prueba_expirada";

                // Pro efectivo: plan pro O override activo
                var proEfectivo = u.Plan == "pro" ||
                    (u.ProOverride && (!u.ProOverrideHasta.HasValue || u.ProOverrideHasta.Value > now));

                // Costes del mes actual
                var costosMes = costosResult.Models
                    .Where(c => c.UsuarioId == u.Id && c.Anio == now.Year && c.Mes == now.Month)
                    .FirstOrDefault();

                return new
                {
                    id              = u.Id,
                    nombre          = u.Nombre,
                    email           = u.Email,
                    activo          = u.Activo,
                    activoDesde     = u.ActivoDesde,
                    creadoFecha     = u.CreadoFecha,
                    plan            = u.Plan,
                    estado          = estadoEfectivo,
                    pruebaHasta     = u.PruebaHasta,
                    proOverride     = u.ProOverride,
                    proOverrideHasta= u.ProOverrideHasta,
                    proEfectivo,
                    notasAdmin      = u.NotasAdmin,
                    costoMesActual  = costosMes == null ? null : (object)new
                    {
                        claude      = costosMes.CostoClaudeEur,
                        outscraper  = costosMes.CostoOutscraperEur,
                        total       = costosMes.CostoClaudeEur + costosMes.CostoOutscraperEur,
                        notas       = costosMes.Notas,
                    },
                    negocio = negocios.TryGetValue(u.Id, out var n)
                        ? (object)new { id = n.Id, nombre = n.Nombre, placeId = n.PlaceId }
                        : null,
                };
            });

        return Ok(data);
    }

    [HttpGet("stats")]
    public async Task<IActionResult> GetStats()
    {
        if (!IsAdmin()) return Forbid();

        var reviewsResult  = await _supabase.From<ReviewEntity>().Get();
        var usuariosResult = await _supabase.From<UsuarioEntity>().Get();
        var costosResult   = await _supabase.From<CostoMesEntity>().Get();

        var now = DateTimeOffset.UtcNow;
        var usuarios = usuariosResult.Models;

        var activos   = usuarios.Count(u => u.Estado == "activo" && u.Activo);
        var prueba    = usuarios.Count(u => u.Estado == "prueba" && (!u.PruebaHasta.HasValue || u.PruebaHasta.Value >= now));
        var baneados  = usuarios.Count(u => u.Estado == "baneado" ||
            (u.Estado == "prueba" && u.PruebaHasta.HasValue && u.PruebaHasta.Value < now));
        var proUsers  = usuarios.Count(u => u.Plan == "pro" ||
            (u.ProOverride && (!u.ProOverrideHasta.HasValue || u.ProOverrideHasta.Value > now)));

        // Costes mes actual totales
        var mesActualCostos = costosResult.Models.Where(c => c.Anio == now.Year && c.Mes == now.Month).ToList();
        var costoTotalClaude     = mesActualCostos.Sum(c => c.CostoClaudeEur);
        var costoTotalOutscraper = mesActualCostos.Sum(c => c.CostoOutscraperEur);

        return Ok(new
        {
            totalReviews = reviewsResult.Models.Count,
            totalUsuarios = usuarios.Count,
            activos,
            prueba,
            baneados,
            proUsers,
            costoMesActual = new
            {
                claude     = costoTotalClaude,
                outscraper = costoTotalOutscraper,
                total      = costoTotalClaude + costoTotalOutscraper,
            }
        });
    }

    // ─── Cambiar estado ───────────────────────────────────────────────────────

    /// <summary>
    /// Cambia el estado del usuario.
    /// Body: { "estado": "activo"|"baneado"|"prueba", "diasPrueba": 14 }
    /// </summary>
    [HttpPost("usuarios/{id}/estado")]
    public async Task<IActionResult> CambiarEstado(Guid id, [FromBody] CambiarEstadoRequest request)
    {
        if (!IsAdmin()) return Forbid();
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
        else if (request.Estado != "prueba")
        {
            // No borramos PruebaHasta histórico, solo dejamos el estado cambiar
        }

        await _supabase.From<UsuarioEntity>().Where(u => u.Id == id).Update(usuario);
        _logger.LogInformation("[AdminController] Usuario {UserId} estado → {Estado} (prueba_hasta={Hasta})",
            id, request.Estado, usuario.PruebaHasta);
        return Ok(new { estado = usuario.Estado, pruebaHasta = usuario.PruebaHasta });
    }

    // ─── Pro Override ─────────────────────────────────────────────────────────

    /// <summary>
    /// Activa/desactiva el override Pro manual.
    /// Body: { "activo": true, "diasExpira": 30 }  (diasExpira=null → sin caducidad)
    /// </summary>
    [HttpPost("usuarios/{id}/pro-override")]
    public async Task<IActionResult> ProOverride(Guid id, [FromBody] ProOverrideRequest request)
    {
        if (!IsAdmin()) return Forbid();

        var result = await _supabase.From<UsuarioEntity>().Where(u => u.Id == id).Limit(1).Get();
        var usuario = result.Models.FirstOrDefault();
        if (usuario == null) return NotFound();

        usuario.ProOverride = request.Activo;
        usuario.ProOverrideHasta = request.Activo && request.DiasExpira.HasValue
            ? DateTimeOffset.UtcNow.AddDays(request.DiasExpira.Value)
            : (DateTimeOffset?)null;

        await _supabase.From<UsuarioEntity>().Where(u => u.Id == id).Update(usuario);
        _logger.LogInformation("[AdminController] Usuario {UserId} ProOverride={Override} hasta={Hasta}",
            id, request.Activo, usuario.ProOverrideHasta);
        return Ok(new { proOverride = usuario.ProOverride, proOverrideHasta = usuario.ProOverrideHasta });
    }

    // ─── Notas admin ──────────────────────────────────────────────────────────

    [HttpPut("usuarios/{id}/notas")]
    public async Task<IActionResult> ActualizarNotas(Guid id, [FromBody] NotasAdminRequest request)
    {
        if (!IsAdmin()) return Forbid();

        var result = await _supabase.From<UsuarioEntity>().Where(u => u.Id == id).Limit(1).Get();
        var usuario = result.Models.FirstOrDefault();
        if (usuario == null) return NotFound();

        usuario.NotasAdmin = request.Notas;
        await _supabase.From<UsuarioEntity>().Where(u => u.Id == id).Update(usuario);
        _logger.LogInformation("[AdminController] Notas admin actualizadas para usuario {UserId}", id);
        return Ok();
    }

    // ─── Plan ─────────────────────────────────────────────────────────────────

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
        _logger.LogInformation("[AdminController] Usuario {UserId} plan → {Plan}", id, request.Plan);
        return Ok();
    }

    // ─── Costes reales ────────────────────────────────────────────────────────

    /// <summary>Devuelve todos los registros de costes (todos los usuarios, todos los meses)</summary>
    [HttpGet("costos")]
    public async Task<IActionResult> GetCostos()
    {
        if (!IsAdmin()) return Forbid();
        var result = await _supabase.From<CostoMesEntity>().Get();
        return Ok(result.Models.OrderByDescending(c => c.Anio).ThenByDescending(c => c.Mes));
    }

    /// <summary>
    /// Upsert de costes para un usuario/año/mes concreto.
    /// Body: { "costoClaudeEur": 1.23, "costoOutscraperEur": 0.45, "notas": "..." }
    /// </summary>
    [HttpPut("costos/{usuarioId}/{anio}/{mes}")]
    public async Task<IActionResult> UpsertCosto(Guid usuarioId, int anio, int mes, [FromBody] UpsertCostoRequest request)
    {
        if (!IsAdmin()) return Forbid();
        if (mes < 1 || mes > 12) return BadRequest("Mes inválido (1-12)");

        // Buscar registro existente
        var existing = await _supabase.From<CostoMesEntity>()
            .Where(c => c.UsuarioId == usuarioId && c.Anio == anio && c.Mes == mes)
            .Limit(1).Get();

        var entity = existing.Models.FirstOrDefault();
        if (entity == null)
        {
            entity = new CostoMesEntity
            {
                Id           = Guid.NewGuid(),
                UsuarioId    = usuarioId,
                Anio         = anio,
                Mes          = mes,
            };
        }

        entity.CostoClaudeEur     = request.CostoClaudeEur;
        entity.CostoOutscraperEur = request.CostoOutscraperEur;
        entity.Notas              = request.Notas;
        entity.UpdatedAt          = DateTimeOffset.UtcNow;

        await _supabase.From<CostoMesEntity>().Upsert(entity);
        _logger.LogInformation("[AdminController] Costo upsert usuario={UserId} {Anio}/{Mes} claude={C} outscraper={O}",
            usuarioId, anio, mes, request.CostoClaudeEur, request.CostoOutscraperEur);
        return Ok(new { total = request.CostoClaudeEur + request.CostoOutscraperEur });
    }

    // ─── Place ID (admin override) ────────────────────────────────────────────

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

        _logger.LogInformation("[AdminController] place_id negocio {NegocioId}: {Old} → {New}", negocioId, old, request.PlaceId);
        return Ok(new { negocioId, placeId = request.PlaceId });
    }

    // ─── Activar/Desactivar legacy (compatibilidad) ───────────────────────────

    [HttpPost("usuarios/{id}/activar")]
    public async Task<IActionResult> Activar(Guid id)
    {
        if (!IsAdmin()) return Forbid();
        return await CambiarEstado(id, new CambiarEstadoRequest("activo", null));
    }

    [HttpPost("usuarios/{id}/desactivar")]
    public async Task<IActionResult> Desactivar(Guid id)
    {
        if (!IsAdmin()) return Forbid();
        return await CambiarEstado(id, new CambiarEstadoRequest("baneado", null));
    }
}

// ─── Request records ─────────────────────────────────────────────────────────

public record CambiarEstadoRequest(string Estado, int? DiasPrueba);
public record ProOverrideRequest(bool Activo, int? DiasExpira);
public record NotasAdminRequest(string? Notas);
public record CambiarPlanRequest(string Plan);
public record UpsertCostoRequest(decimal CostoClaudeEur, decimal CostoOutscraperEur, string? Notas);
public record SetPlaceIdRequest(string PlaceId);
