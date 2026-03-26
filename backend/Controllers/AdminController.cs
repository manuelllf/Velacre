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

        var negocios = negociosResult.Models
            .Where(n => n.IdUsuario.HasValue)
            .GroupBy(n => n.IdUsuario!.Value)
            .ToDictionary(g => g.Key, g => g.First());

        var now = DateTimeOffset.UtcNow;

        var data = usuariosResult.Models
            .OrderBy(u => u.CreadoFecha)
            .Select(u =>
            {
                // Estado efectivo (prueba expirada → se muestra como prueba_expirada)
                var estadoEfectivo = u.Estado;
                if (u.Estado == "prueba" && u.PruebaHasta.HasValue && u.PruebaHasta.Value < now)
                    estadoEfectivo = "prueba_expirada";

                // Pro efectivo: plan pro O override activo
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
                    negocio = negocios.TryGetValue(u.Id, out var n)
                        ? (object)new { id = n.Id, nombre = n.Nombre, placeId = n.PlaceId, salesId = n.SalesId }
                        : null,
                    rol = u.Rol,
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

        var activos  = usuarios.Count(u => u.Estado == "activo" && u.Activo);
        var prueba   = usuarios.Count(u => u.Estado == "prueba" && (!u.PruebaHasta.HasValue || u.PruebaHasta.Value >= now));
        var baneados = usuarios.Count(u => u.Estado == "baneado" ||
            (u.Estado == "prueba" && u.PruebaHasta.HasValue && u.PruebaHasta.Value < now));
        var proUsers = usuarios.Count(u => u.Plan == "pro" ||
            (u.ProOverride && (!u.ProOverrideHasta.HasValue || u.ProOverrideHasta.Value > now)));

        // Coste plataforma mes actual (registro único global)
        var costoMes = costosResult.Models.FirstOrDefault(c => c.Anio == now.Year && c.Mes == now.Month);

        return Ok(new
        {
            totalReviews  = reviewsResult.Models.Count,
            totalUsuarios = usuarios.Count,
            activos,
            prueba,
            baneados,
            proUsers,
            costoMesActual = new
            {
                claude     = costoMes?.CostoClaudeEur ?? 0,
                outscraper = costoMes?.CostoOutscraperEur ?? 0,
                total      = (costoMes?.CostoClaudeEur ?? 0) + (costoMes?.CostoOutscraperEur ?? 0),
                notas      = costoMes?.Notas,
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

    // ─── Costes reales (totales plataforma) ──────────────────────────────────────

    /// <summary>Devuelve el histórico de costes mensuales totales de la plataforma</summary>
    [HttpGet("costos")]
    public async Task<IActionResult> GetCostos()
    {
        if (!IsAdmin()) return Forbid();
        var result = await _supabase.From<CostoMesEntity>().Get();
        return Ok(result.Models.OrderByDescending(c => c.Anio).ThenByDescending(c => c.Mes));
    }

    /// <summary>
    /// Upsert del coste total de la plataforma para un año/mes concreto.
    /// Body: { "costoClaudeEur": 12.50, "costoOutscraperEur": 3.20, "notas": "..." }
    /// </summary>
    [HttpPut("costos/{anio}/{mes}")]
    public async Task<IActionResult> UpsertCosto(int anio, int mes, [FromBody] UpsertCostoRequest request)
    {
        if (!IsAdmin()) return Forbid();
        if (mes < 1 || mes > 12) return BadRequest("Mes inválido (1-12)");

        var existing = await _supabase.From<CostoMesEntity>()
            .Where(c => c.Anio == anio && c.Mes == mes)
            .Limit(1).Get();

        var entity = existing.Models.FirstOrDefault();
        if (entity == null)
        {
            entity = new CostoMesEntity { Id = Guid.NewGuid(), Anio = anio, Mes = mes };
        }

        entity.CostoClaudeEur     = request.CostoClaudeEur;
        entity.CostoOutscraperEur = request.CostoOutscraperEur;
        entity.Notas              = request.Notas;
        entity.UpdatedAt          = DateTimeOffset.UtcNow;

        await _supabase.From<CostoMesEntity>().Upsert(entity);
        _logger.LogInformation("[AdminController] Costo plataforma {Anio}/{Mes} → claude={C} outscraper={O}",
            anio, mes, request.CostoClaudeEur, request.CostoOutscraperEur);
        return Ok(new { total = request.CostoClaudeEur + request.CostoOutscraperEur });
    }

    // ─── Place ID (admin override) ────────────────────────────────────────────

    [HttpPut("negocios/{negocioId}/place")]
    public async Task<IActionResult> SetPlaceId(Guid negocioId, [FromBody] SetPlaceIdRequest request)
    {
        if (!IsAdmin()) return Forbid();
        if (string.IsNullOrWhiteSpace(request.PlaceId)) return BadRequest("place_id no puede estar vacío.");

        try
        {
            var result = await _supabase.From<NegocioEntity>().Where(n => n.Id == negocioId).Limit(1).Get();
            var negocio = result.Models.FirstOrDefault();
            if (negocio == null)
            {
                _logger.LogWarning("[AdminController] SetPlaceId: negocio {NegocioId} no encontrado", negocioId);
                return NotFound($"Negocio {negocioId} no encontrado");
            }

            _logger.LogInformation("[AdminController] SetPlaceId: encontrado negocio={NegocioId} nombre={Nombre} placeId_actual={Old}",
                negocioId, negocio.Nombre, negocio.PlaceId);

            var old = negocio.PlaceId;
            negocio.PlaceId = request.PlaceId;
            negocio.ActualizadoFecha = DateTimeOffset.UtcNow;

            await _supabase.From<NegocioEntity>().Update(negocio);

            return Ok(new { negocioId, old, placeId = request.PlaceId });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AdminController] SetPlaceId: error actualizando negocio {NegocioId}", negocioId);
            return StatusCode(500, ex.Message);
        }
    }

    // ─── Rol ──────────────────────────────────────────────────────────────────

    [HttpPut("usuarios/{id}/rol")]
    public async Task<IActionResult> AsignarRol(Guid id, [FromBody] AsignarRolRequest request)
    {
        if (!IsAdmin()) return Forbid();
        if (request.Rol != "cliente" && request.Rol != "sales")
            return BadRequest("Rol inválido. Valores: cliente, sales");

        var result = await _supabase.From<UsuarioEntity>().Where(u => u.Id == id).Limit(1).Get();
        var usuario = result.Models.FirstOrDefault();
        if (usuario == null) return NotFound();

        usuario.Rol = request.Rol;
        await _supabase.From<UsuarioEntity>().Where(u => u.Id == id).Update(usuario);
        _logger.LogInformation("[AdminController] Usuario {UserId} rol → {Rol}", id, request.Rol);
        return Ok(new { rol = request.Rol });
    }

    // ─── Asignar Sales a un negocio ───────────────────────────────────────────

    [HttpPut("negocios/{negocioId}/sales")]
    public async Task<IActionResult> AsignarSales(Guid negocioId, [FromBody] AsignarSalesRequest request)
    {
        if (!IsAdmin()) return Forbid();

        var result = await _supabase.From<NegocioEntity>().Where(n => n.Id == negocioId).Limit(1).Get();
        var negocio = result.Models.FirstOrDefault();
        if (negocio == null) return NotFound();

        // Verificar que el sales user existe y tiene rol sales
        if (request.SalesId.HasValue)
        {
            var salesResult = await _supabase.From<UsuarioEntity>()
                .Where(u => u.Id == request.SalesId.Value).Limit(1).Get();
            var salesUser = salesResult.Models.FirstOrDefault();
            if (salesUser == null) return NotFound("Usuario Sales no encontrado");
            if (salesUser.Rol != "sales") return BadRequest("El usuario no tiene rol Sales");
        }

        negocio.SalesId = request.SalesId;
        negocio.ActualizadoFecha = DateTimeOffset.UtcNow;
        await _supabase.From<NegocioEntity>().Where(n => n.Id == negocioId).Update(negocio);
        _logger.LogInformation("[AdminController] Negocio {NegocioId} sales_id → {SalesId}", negocioId, request.SalesId);
        return Ok(new { negocioId, salesId = request.SalesId });
    }

    // ─── Lista usuarios con rol Sales ────────────────────────────────────────

    [HttpGet("sales-team")]
    public async Task<IActionResult> GetSalesTeam()
    {
        if (!IsAdmin()) return Forbid();

        var usuariosResult = await _supabase.From<UsuarioEntity>()
            .Where(u => u.Rol == "sales").Get();
        var negociosResult = await _supabase.From<NegocioEntity>().Get();

        var data = usuariosResult.Models.Select(u =>
        {
            var asignados = negociosResult.Models.Where(n => n.SalesId == u.Id).ToList();
            return new
            {
                id       = u.Id,
                nombre   = u.Nombre,
                email    = u.Email,
                rol      = u.Rol,
                clientes = asignados.Count,
                proClientes = asignados.Count(n => {
                    // Necesitamos el plan del usuario dueño del negocio
                    return false; // se calcula en frontend con datos de usuarios
                }),
                negocios = asignados.Select(n => new { n.Id, n.Nombre, n.PlaceId }),
            };
        });

        return Ok(data);
    }

    // ─── Liquidaciones ────────────────────────────────────────────────────────

    [HttpGet("liquidaciones")]
    public async Task<IActionResult> GetLiquidaciones()
    {
        if (!IsAdmin()) return Forbid();
        var result = await _supabase.From<LiquidacionEntity>().Get();
        var salesResult = await _supabase.From<UsuarioEntity>().Where(u => u.Rol == "sales").Get();
        var salesMap = salesResult.Models.ToDictionary(u => u.Id, u => u.Nombre ?? u.Email ?? u.Id.ToString());

        var data = result.Models
            .OrderByDescending(l => l.Anio).ThenByDescending(l => l.Mes)
            .Select(l =>
            {
                var neto      = l.IngresosBrutos - l.CostosApi - l.FeesPasarela;
                var comision  = neto * (l.ComisionPct / 100m);
                return new
                {
                    id             = l.Id,
                    salesId        = l.SalesId,
                    salesNombre    = salesMap.TryGetValue(l.SalesId, out var n) ? n : l.SalesId.ToString(),
                    anio           = l.Anio,
                    mes            = l.Mes,
                    ingresosBrutos = l.IngresosBrutos,
                    costosApi      = l.CostosApi,
                    feesPasarela   = l.FeesPasarela,
                    neto,
                    comisionPct    = l.ComisionPct,
                    comision,
                    pagado         = l.Pagado,
                    pagadoFecha    = l.PagadoFecha,
                    notas          = l.Notas,
                };
            });

        return Ok(data);
    }

    [HttpPut("liquidaciones/{salesId}/{anio}/{mes}")]
    public async Task<IActionResult> UpsertLiquidacion(
        Guid salesId, int anio, int mes,
        [FromBody] UpsertLiquidacionRequest request)
    {
        if (!IsAdmin()) return Forbid();
        if (mes < 1 || mes > 12) return BadRequest("Mes inválido");

        // postgrest-csharp no soporta 3 Where encadenados — filtramos anio+mes en memoria
        var existing = await _supabase.From<LiquidacionEntity>()
            .Where(l => l.SalesId == salesId)
            .Get();

        var entity = existing.Models.FirstOrDefault(l => l.Anio == anio && l.Mes == mes);
        if (entity == null)
            entity = new LiquidacionEntity { Id = Guid.NewGuid(), SalesId = salesId, Anio = anio, Mes = mes, CreatedAt = DateTimeOffset.UtcNow };

        entity.IngresosBrutos = request.IngresosBrutos;
        entity.CostosApi      = request.CostosApi;
        entity.FeesPasarela   = request.FeesPasarela;
        entity.ComisionPct    = request.ComisionPct;
        entity.Notas          = request.Notas;

        await _supabase.From<LiquidacionEntity>().Upsert(entity);
        _logger.LogInformation("[AdminController] Liquidación {SalesId} {Anio}/{Mes} upserted", salesId, anio, mes);

        var neto     = entity.IngresosBrutos - entity.CostosApi - entity.FeesPasarela;
        var comision = neto * (entity.ComisionPct / 100m);
        return Ok(new { neto, comision });
    }

    [HttpPost("liquidaciones/{id}/pagar")]
    public async Task<IActionResult> MarcarPagado(Guid id)
    {
        if (!IsAdmin()) return Forbid();
        var result = await _supabase.From<LiquidacionEntity>().Where(l => l.Id == id).Limit(1).Get();
        var entity = result.Models.FirstOrDefault();
        if (entity == null) return NotFound();

        entity.Pagado      = true;
        entity.PagadoFecha = DateTimeOffset.UtcNow;
        await _supabase.From<LiquidacionEntity>().Where(l => l.Id == id).Update(entity);
        _logger.LogInformation("[AdminController] Liquidación {Id} marcada como pagada", id);
        return Ok(new { pagado = true, pagadoFecha = entity.PagadoFecha });
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
public record AsignarRolRequest(string Rol);
public record AsignarSalesRequest(Guid? SalesId);
public record UpsertLiquidacionRequest(
    decimal IngresosBrutos,
    decimal CostosApi,
    decimal FeesPasarela,
    decimal ComisionPct,
    string? Notas);
