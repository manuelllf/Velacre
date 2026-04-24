using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using backend.Infrastructure;
using backend.Interfaces;
using backend.Models.Entities;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AdminController : ControllerBase
{
    private readonly IUsuarioRepository _usuarioRepo;
    private readonly INegocioRepository _negocioRepo;
    private readonly ILogger<AdminController> _logger;
    private readonly IOutscraperService _outscraper;
    private readonly IReviewAiService _aiService;
    private readonly Guid _adminUserId;

    public AdminController(
        IUsuarioRepository usuarioRepo,
        INegocioRepository negocioRepo,
        ILogger<AdminController> logger,
        IOutscraperService outscraper,
        IReviewAiService aiService)
    {
        _usuarioRepo = usuarioRepo;
        _negocioRepo = negocioRepo;
        _logger = logger;
        _outscraper = outscraper;
        _aiService = aiService;
        _adminUserId = Guid.Parse(Environment.GetEnvironmentVariable("ADMIN_USER_ID") ?? "00000000-0000-0000-0000-000000000000");
    }

    private async Task<bool> IsAdminAsync()
    {
        var userId = User.GetUserId();
        if (userId == _adminUserId) return true;
        var usuario = await _usuarioRepo.GetByIdAsync(userId);
        return usuario?.Rol == "admin";
    }

    [HttpGet("usuarios")]
    public async Task<IActionResult> GetUsuarios()
    {
        if (!await IsAdminAsync()) return Forbid();

        var usuarios = await _usuarioRepo.GetAllAsync();
        // Agrupamos TODOS los negocios del usuario (multi-local). El principal
        // queda en `negocio` para compatibilidad; el array completo va en `negocios`.
        var negociosPorUsuario = (await _negocioRepo.GetAllAsync())
            .Where(n => n.IdUsuario.HasValue)
            .GroupBy(n => n.IdUsuario!.Value)
            .ToDictionary(g => g.Key, g => g.ToList());

        var now = DateTimeOffset.UtcNow;

        var data = usuarios
            .OrderBy(u => u.CreadoFecha)
            .Select(u =>
            {
                var estadoEfectivo = u.Estado;
                if (u.Estado == "prueba" && u.PruebaHasta.HasValue && u.PruebaHasta.Value < now)
                    estadoEfectivo = "prueba_expirada";

                var proEfectivo = u.Plan == "pro" ||
                    (u.ProOverride && (!u.ProOverrideHasta.HasValue || u.ProOverrideHasta.Value > now));

                var listaNegocios = negociosPorUsuario.TryGetValue(u.Id, out var negs) ? negs : new List<NegocioEntity>();
                // Principal = el marcado con es_principal, fallback al primero.
                var principal = listaNegocios.FirstOrDefault(n => n.EsPrincipal) ?? listaNegocios.FirstOrDefault();

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
                    iniciosSesion        = u.IniciosSesion,
                    ultimoInicioSesion   = u.UltimoInicioSesion,
                    negocio = principal != null
                        ? (object)new { id = principal.Id, nombre = principal.Nombre, placeId = principal.PlaceId }
                        : null,
                    negocios = listaNegocios
                        .OrderByDescending(n => n.EsPrincipal)
                        .ThenBy(n => n.CreadoFecha)
                        .Select(n => new {
                            id = n.Id,
                            nombre = n.Nombre,
                            placeId = n.PlaceId,
                            estado = n.Estado,
                            esPrincipal = n.EsPrincipal,
                        })
                        .ToArray(),
                };
            });

        return Ok(data);
    }

    [HttpPost("usuarios/{id}/estado")]
    public async Task<IActionResult> CambiarEstado(Guid id, [FromBody] CambiarEstadoRequest request)
    {
        if (!await IsAdminAsync()) return Forbid();
        if (request.Estado != "activo" && request.Estado != "baneado" && request.Estado != "prueba")
            return BadRequest("Estado inválido. Valores: activo, baneado, prueba");

        var usuario = await _usuarioRepo.GetByIdAsync(id);
        if (usuario == null) return NotFound();

        var now = DateTimeOffset.UtcNow;
        var activo = request.Estado == "activo";
        var activoDesde = (usuario.ActivoDesde == null && (request.Estado == "activo" || request.Estado == "prueba"))
            ? now : usuario.ActivoDesde;
        var pruebaHasta = request.Estado == "prueba"
            ? now.AddDays(request.DiasPrueba ?? 14) : usuario.PruebaHasta;

        await _usuarioRepo.UpdateEstadoAsync(id, request.Estado, activo, activoDesde, pruebaHasta);
        _logger.LogInformation("[AdminController] Usuario {UserId} estado → {Estado}", id, request.Estado);
        return Ok(new { estado = request.Estado, pruebaHasta });
    }

    [HttpPost("usuarios/{id}/pro-override")]
    public async Task<IActionResult> ProOverride(Guid id, [FromBody] ProOverrideRequest request)
    {
        if (!await IsAdminAsync()) return Forbid();

        var usuario = await _usuarioRepo.GetByIdAsync(id);
        if (usuario == null) return NotFound();

        var proOverrideHasta = request.Activo && request.DiasExpira.HasValue
            ? DateTimeOffset.UtcNow.AddDays(request.DiasExpira.Value)
            : (DateTimeOffset?)null;

        await _usuarioRepo.UpdateProOverrideAsync(id, request.Activo, proOverrideHasta);
        _logger.LogInformation("[AdminController] Usuario {UserId} ProOverride={Override}", id, request.Activo);
        return Ok(new { proOverride = request.Activo, proOverrideHasta });
    }

    [HttpPut("usuarios/{id}/notas")]
    public async Task<IActionResult> ActualizarNotas(Guid id, [FromBody] NotasAdminRequest request)
    {
        if (!await IsAdminAsync()) return Forbid();

        var usuario = await _usuarioRepo.GetByIdAsync(id);
        if (usuario == null) return NotFound();

        await _usuarioRepo.UpdateNotasAsync(id, request.Notas);
        return Ok();
    }

    [HttpPost("usuarios/{id}/plan")]
    public async Task<IActionResult> CambiarPlan(Guid id, [FromBody] CambiarPlanRequest request)
    {
        if (!await IsAdminAsync()) return Forbid();
        if (request.Plan != "basic" && request.Plan != "core" && request.Plan != "pro")
            return BadRequest("Plan inválido. Valores: basic, core, pro");

        var usuario = await _usuarioRepo.GetByIdAsync(id);
        if (usuario == null) return NotFound();

        await _usuarioRepo.UpdatePlanAsync(id, request.Plan);
        _logger.LogInformation("[AdminController] Usuario {UserId} plan → {Plan}", id, request.Plan);
        return Ok();
    }

    [HttpPut("negocios/{negocioId}/place")]
    public async Task<IActionResult> SetPlaceId(Guid negocioId, [FromBody] SetPlaceIdRequest request)
    {
        if (!await IsAdminAsync()) return Forbid();
        if (string.IsNullOrWhiteSpace(request.PlaceId)) return BadRequest("place_id no puede estar vacío.");

        try
        {
            var negocio = await _negocioRepo.GetByIdAsync(negocioId);
            if (negocio == null) return NotFound($"Negocio {negocioId} no encontrado");

            var old = negocio.PlaceId;
            negocio.PlaceId = request.PlaceId;
            negocio.ActualizadoFecha = DateTimeOffset.UtcNow;
            await _negocioRepo.UpdateAsync(negocio);

            _logger.LogInformation("[AdminController] SetPlaceId: negocio {NegocioId} {Old} → {New}", negocioId, old, request.PlaceId);
            return Ok(new { negocioId, old, placeId = request.PlaceId });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AdminController] SetPlaceId error negocio {NegocioId}", negocioId);
            throw;
        }
    }

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

    [HttpPut("usuarios/{id}/rol")]
    public async Task<IActionResult> AsignarRol(Guid id, [FromBody] AsignarRolRequest request)
    {
        if (!await IsAdminAsync()) return Forbid();
        if (request.Rol != "cliente" && request.Rol != "admin")
            return BadRequest("Rol inválido. Valores: cliente, admin");

        var usuario = await _usuarioRepo.GetByIdAsync(id);
        if (usuario == null) return NotFound();

        await _usuarioRepo.UpdateRolAsync(id, request.Rol);
        _logger.LogInformation("[AdminController] Usuario {UserId} rol → {Rol}", id, request.Rol);
        return Ok(new { rol = request.Rol });
    }

    [HttpPost("mini-radar")]
    public async Task<IActionResult> MiniRadar([FromBody] MiniRadarRequest request)
    {
        if (!await IsAdminAsync()) return Forbid();
        if (string.IsNullOrWhiteSpace(request.PlaceId))
            return BadRequest(new { error = "place_id_required", mensaje = "Se requiere place_id" });

        _logger.LogInformation("[MiniRadar] Analizando placeId={PlaceId} nombre={Nombre}",
            request.PlaceId, request.Nombre ?? "(sin nombre)");

        // Reseñas del último mes reales (con owner_answer mapeado para %respondidas correcto)
        // Limit 60 = valor validado por el pipeline outreach; Outscraper v3 timeoutea con valores más altos.
        var resenas = await _outscraper.GetRecentReviewsAsync(request.PlaceId, dias: 30, maxReviews: 60);
        if (resenas.Count == 0)
            return NotFound(new
            {
                error = "no_recent_reviews",
                mensaje = "No se han encontrado reseñas en los últimos 30 días para este negocio"
            });

        var total = resenas.Count;
        var ratingAvg = resenas.Average(r => r.StarRating);
        var respondidas = resenas.Count(r => !string.IsNullOrEmpty(r.OwnerAnswer));
        var pctRespondidas = (int)Math.Round((double)respondidas / total * 100);

        // Rango real de fechas del sample (para transparencia en el PDF)
        var fechaDesde = resenas.Min(r => r.PublishedAt);
        var fechaHasta = resenas.Max(r => r.PublishedAt);

        var dist = new Dictionary<string, int>
        {
            ["s5"] = resenas.Count(r => r.StarRating == 5),
            ["s4"] = resenas.Count(r => r.StarRating == 4),
            ["s3"] = resenas.Count(r => r.StarRating == 3),
            ["s2"] = resenas.Count(r => r.StarRating == 2),
            ["s1"] = resenas.Count(r => r.StarRating == 1),
        };

        var peoresSinResponder = resenas
            .Where(r => string.IsNullOrEmpty(r.OwnerAnswer) && r.StarRating <= 3 && !string.IsNullOrEmpty(r.Text))
            .OrderBy(r => r.StarRating)
            .ThenByDescending(r => r.PublishedAt)
            .Take(3)
            .Select(r => new
            {
                autor = r.AuthorName,
                rating = r.StarRating,
                texto = r.Text.Length > 240 ? r.Text[..240] + "..." : r.Text,
                fecha = r.PublishedAt,
            })
            .ToList();

        var resenasText = string.Join("\n", resenas.Select(r =>
        {
            var textCorto = r.Text.Length > 200 ? r.Text[..200] : r.Text;
            var respuesta = string.IsNullOrEmpty(r.OwnerAnswer)
                ? "→ SIN RESPUESTA"
                : $"→ Respuesta propietario: \"{(r.OwnerAnswer.Length > 150 ? r.OwnerAnswer[..150] + "..." : r.OwnerAnswer)}\"";
            var autor = !string.IsNullOrEmpty(r.AuthorName) ? $"[{r.AuthorName}] " : "";
            return $"- {autor}{r.StarRating}★ \"{textCorto}\" {respuesta}";
        }));

        var nombreDisplay = string.IsNullOrWhiteSpace(request.Nombre) ? "el negocio" : request.Nombre;

        backend.Models.Responses.MiniRadarAnalysis analisis;
        try
        {
            analisis = await _aiService.AnalyzeMiniRadarAsync(
                nombreDisplay, resenasText, ratingAvg, pctRespondidas, total, fechaDesde, fechaHasta);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[MiniRadar] Claude falló tras reintentos");
            return StatusCode(502, new { error = "ai_unavailable", mensaje = "El servicio de IA no pudo completar el análisis. Inténtalo de nuevo en unos segundos." });
        }

        _logger.LogInformation("[MiniRadar] OK — total={Total} respondidas={Pct}% rating={Rating:F2} oportunidad={Op}",
            total, pctRespondidas, ratingAvg, analisis.Oportunidad?.Titulo ?? "—");

        return Ok(new
        {
            placeId = request.PlaceId,
            nombre = request.Nombre,
            stats = new
            {
                total,
                ratingAvg = Math.Round(ratingAvg, 2),
                distribucion = dist,
                pctRespondidas,
                fechaDesde,
                fechaHasta,
            },
            peoresSinResponder,
            analisis,
            generadoEn = DateTimeOffset.UtcNow,
        });
    }
}

public record CambiarEstadoRequest(string Estado, int? DiasPrueba);
public record ProOverrideRequest(bool Activo, int? DiasExpira);
public record NotasAdminRequest(string? Notas);
public record CambiarPlanRequest(string Plan);
public record SetPlaceIdRequest(string PlaceId);
public record AsignarRolRequest(string Rol);
public record MiniRadarRequest(string PlaceId, string? Nombre);
