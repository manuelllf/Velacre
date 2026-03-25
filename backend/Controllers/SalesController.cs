using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using backend.Models.Entities;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SalesController : ControllerBase
{
    private readonly Supabase.Client _supabase;
    private readonly ILogger<SalesController> _logger;

    public SalesController(Supabase.Client supabase, ILogger<SalesController> logger)
    {
        _supabase = supabase;
        _logger = logger;
    }

    private async Task<UsuarioEntity?> GetSalesUser()
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        var result = await _supabase.From<UsuarioEntity>().Where(u => u.Id == userId).Limit(1).Get();
        var usuario = result.Models.FirstOrDefault();
        if (usuario == null || usuario.Rol != "sales") return null;
        return usuario;
    }

    // ─── Portfolio: negocios asignados a este Sales ───────────────────────────

    [HttpGet("portfolio")]
    public async Task<IActionResult> GetPortfolio()
    {
        var sales = await GetSalesUser();
        if (sales == null) return Forbid();

        var negociosResult = await _supabase.From<NegocioEntity>()
            .Where(n => n.SalesId == sales.Id).Get();

        var negocios = negociosResult.Models;
        if (!negocios.Any()) return Ok(new { negocios = Array.Empty<object>() });

        // Cargar los usuarios propietarios para obtener plan y estado
        var ownerIds = negocios
            .Where(n => n.IdUsuario.HasValue)
            .Select(n => n.IdUsuario!.Value)
            .Distinct()
            .ToList();

        var usuariosResult = await _supabase.From<UsuarioEntity>().Get();
        var usuariosMap = usuariosResult.Models.ToDictionary(u => u.Id);

        var now = DateTimeOffset.UtcNow;

        var data = negocios.Select(n =>
        {
            usuariosMap.TryGetValue(n.IdUsuario ?? Guid.Empty, out var owner);
            var estadoEfectivo = owner?.Estado ?? "activo";
            if (owner?.Estado == "prueba" && owner.PruebaHasta.HasValue && owner.PruebaHasta.Value < now)
                estadoEfectivo = "prueba_expirada";

            return new
            {
                negocioId    = n.Id,
                nombre       = n.Nombre,
                placeId      = n.PlaceId,
                plan         = owner?.Plan ?? "basic",
                estadoUsuario = estadoEfectivo,
                activoDesde  = owner?.ActivoDesde,
                userId       = n.IdUsuario,
            };
        }).OrderBy(n => n.nombre);

        return Ok(new { negocios = data });
    }

    // ─── Comisión del mes en curso (preview) ─────────────────────────────────

    [HttpGet("comision")]
    public async Task<IActionResult> GetComisionMes()
    {
        var sales = await GetSalesUser();
        if (sales == null) return Forbid();

        var now = DateTimeOffset.UtcNow;

        // Negocios asignados
        var negociosResult = await _supabase.From<NegocioEntity>()
            .Where(n => n.SalesId == sales.Id).Get();
        var negocios = negociosResult.Models;

        if (!negocios.Any())
            return Ok(new { ingresosEstimados = 0m, costosApiProrrateados = 0m, neto = 0m, comision = 0m, totalClientes = 0, proClientes = 0 });

        // Planes de los propietarios
        var ownerIds = negocios.Where(n => n.IdUsuario.HasValue).Select(n => n.IdUsuario!.Value).ToList();
        var usuariosResult = await _supabase.From<UsuarioEntity>().Get();
        var ownerMap = usuariosResult.Models.Where(u => ownerIds.Contains(u.Id)).ToDictionary(u => u.Id);
        var totalClientes = usuariosResult.Models.Count(u => u.Rol == "cliente" && u.Activo);

        // Ingresos estimados: pro = 49€, basic = 0€
        const decimal PRO_PRICE = 49m;
        var proClientes  = negocios.Count(n => n.IdUsuario.HasValue && ownerMap.TryGetValue(n.IdUsuario!.Value, out var o) && o.Plan == "pro");
        var ingresosEstimados = proClientes * PRO_PRICE;

        // Costos API prorrateados desde costos_mes
        var costoMesResult = await _supabase.From<CostoMesEntity>()
            .Where(c => c.Anio == now.Year && c.Mes == now.Month).Limit(1).Get();
        var costoMes = costoMesResult.Models.FirstOrDefault();
        var totalCostosApi   = (costoMes?.CostoClaudeEur ?? 0) + (costoMes?.CostoOutscraperEur ?? 0);
        var prorrateo        = totalClientes > 0 ? (decimal)negocios.Count / totalClientes : 0;
        var costosApiProrrateados = totalCostosApi * prorrateo;

        var neto     = ingresosEstimados - costosApiProrrateados;
        var comision = neto * 0.30m;

        return Ok(new
        {
            ingresosEstimados,
            costosApiProrrateados = Math.Round(costosApiProrrateados, 2),
            neto     = Math.Round(neto, 2),
            comision = Math.Round(comision, 2),
            totalClientes = negocios.Count,
            proClientes,
        });
    }

    // ─── Histórico de liquidaciones ───────────────────────────────────────────

    [HttpGet("liquidaciones")]
    public async Task<IActionResult> GetLiquidaciones()
    {
        var sales = await GetSalesUser();
        if (sales == null) return Forbid();

        var result = await _supabase.From<LiquidacionEntity>()
            .Where(l => l.SalesId == sales.Id).Get();

        var data = result.Models
            .OrderByDescending(l => l.Anio).ThenByDescending(l => l.Mes)
            .Select(l =>
            {
                var neto     = l.IngresosBrutos - l.CostosApi - l.FeesPasarela;
                var comision = neto * (l.ComisionPct / 100m);
                return new
                {
                    id             = l.Id,
                    anio           = l.Anio,
                    mes            = l.Mes,
                    ingresosBrutos = l.IngresosBrutos,
                    costosApi      = l.CostosApi,
                    feesPasarela   = l.FeesPasarela,
                    neto           = Math.Round(neto, 2),
                    comisionPct    = l.ComisionPct,
                    comision       = Math.Round(comision, 2),
                    pagado         = l.Pagado,
                    pagadoFecha    = l.PagadoFecha,
                    notas          = l.Notas,
                };
            });

        return Ok(data);
    }
}
