using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using backend.Interfaces;
using backend.Models.Entities;
using System.Text.Json;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class RadarController : ControllerBase
{
    private readonly Supabase.Client _supabase;
    private readonly IOutscraperService _outscraper;
    private readonly IReviewAiService _aiService;
    private readonly ILogger<RadarController> _logger;

    private const int MaxCompetidores = 3;

    public RadarController(
        Supabase.Client supabase,
        IOutscraperService outscraper,
        IReviewAiService aiService,
        ILogger<RadarController> logger)
    {
        _supabase   = supabase;
        _outscraper = outscraper;
        _aiService  = aiService;
        _logger     = logger;
    }

    // ─── GET /api/radar ──────────────────────────────────────────────────────
    /// <summary>Devuelve los competidores del negocio + último análisis (si existe).</summary>
    [HttpGet]
    public async Task<IActionResult> GetRadar()
    {
        var (negocio, errorResult) = await GetNegocioAndCheckPlanAsync();
        if (errorResult != null) return errorResult;

        var competidoresRes = await _supabase.From<CompetidorEntity>()
            .Where(c => c.NegocioId == negocio!.Id).Get();

        var analisisRes = await _supabase.From<RadarAnalisisEntity>()
            .Where(a => a.NegocioId == negocio!.Id)
            .Order(a => a.CreatedAt, Postgrest.Constants.Ordering.Descending)
            .Get();

        var utcNow2 = DateTimeOffset.UtcNow;
        var analisisEsteMes = analisisRes.Models
            .Count(a => a.CreatedAt.Year == utcNow2.Year && a.CreatedAt.Month == utcNow2.Month);
        var ultimoAnalisis = analisisRes.Models.FirstOrDefault();

        return Ok(new
        {
            competidores = competidoresRes.Models.Select(c => new
            {
                id        = c.Id,
                placeId   = c.PlaceId,
                nombre    = c.Nombre,
                createdAt = c.CreatedAt,
            }),
            analisisEsteMes,
            ultimoAnalisis = ultimoAnalisis == null ? null : new
            {
                id        = ultimoAnalisis.Id,
                createdAt = ultimoAnalisis.CreatedAt,
                resultado = ParseAnalisisJson(ultimoAnalisis.ResultadoJson),
            }
        });
    }

    // ─── POST /api/radar/competidores ─────────────────────────────────────────
    [HttpPost("competidores")]
    public async Task<IActionResult> AddCompetidor([FromBody] AddCompetidorRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.PlaceId) || string.IsNullOrWhiteSpace(request.Nombre))
            return BadRequest("placeId y nombre son obligatorios.");

        var (negocio, errorResult) = await GetNegocioAndCheckPlanAsync();
        if (errorResult != null) return errorResult;

        var existingRes = await _supabase.From<CompetidorEntity>()
            .Where(c => c.NegocioId == negocio!.Id).Get();

        if (existingRes.Models.Count >= MaxCompetidores)
            return BadRequest(new { error = "max_competidores", max = MaxCompetidores });

        if (existingRes.Models.Any(c => c.PlaceId == request.PlaceId))
            return BadRequest(new { error = "ya_existe" });

        var nuevo = new CompetidorEntity
        {
            Id         = Guid.NewGuid(),
            NegocioId  = negocio!.Id,
            PlaceId    = request.PlaceId,
            Nombre     = request.Nombre.Trim(),
            CreatedAt  = DateTimeOffset.UtcNow,
        };

        await _supabase.From<CompetidorEntity>().Insert(nuevo);
        _logger.LogInformation("[RadarController] Competidor añadido: {Nombre} para negocio={NegocioId}", nuevo.Nombre, negocio.Id);

        return Ok(new { id = nuevo.Id, placeId = nuevo.PlaceId, nombre = nuevo.Nombre, createdAt = nuevo.CreatedAt });
    }

    // ─── DELETE /api/radar/competidores/{id} ──────────────────────────────────
    [HttpDelete("competidores/{id:guid}")]
    public async Task<IActionResult> RemoveCompetidor(Guid id)
    {
        var (negocio, errorResult) = await GetNegocioAndCheckPlanAsync();
        if (errorResult != null) return errorResult;

        await _supabase.From<CompetidorEntity>()
            .Where(c => c.Id == id && c.NegocioId == negocio!.Id)
            .Delete();

        return NoContent();
    }

    // ─── POST /api/radar/analizar ─────────────────────────────────────────────
    /// <summary>
    /// Lanza el análisis comparativo: scrapea competidores + llama Claude.
    /// Coste: 1 llamada Outscraper por competidor + 1 llamada Claude.
    /// </summary>
    [HttpPost("analizar")]
    public async Task<IActionResult> Analizar()
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        var (negocio, errorResult) = await GetNegocioAndCheckPlanAsync();
        if (errorResult != null) return errorResult;

        var competidoresRes = await _supabase.From<CompetidorEntity>()
            .Where(c => c.NegocioId == negocio!.Id).Get();

        if (competidoresRes.Models.Count == 0)
            return BadRequest(new { error = "sin_competidores" });

        // Límite: 2 análisis por mes
        var utcNow = DateTimeOffset.UtcNow;
        var allAnalysisRes = await _supabase.From<RadarAnalisisEntity>()
            .Where(a => a.NegocioId == negocio!.Id)
            .Get();
        var thisMonthCount = allAnalysisRes.Models
            .Count(a => a.CreatedAt.Year == utcNow.Year && a.CreatedAt.Month == utcNow.Month);
        if (thisMonthCount >= 2)
            return StatusCode(429, new { error = "ya_analizado_este_mes" });

        // 1. Reseñas propias desde BD (sin coste)
        var misResenasRes = await _supabase.From<ReviewEntity>()
            .Where(r => r.IdNegocio == negocio!.Id)
            .Order(r => r.ReviewDate, Postgrest.Constants.Ordering.Descending)
            .Limit(30).Get();

        var misResenas = misResenasRes.Models
            .Where(r => !string.IsNullOrWhiteSpace(r.ClienteReview))
            .Select(r => $"{r.StarRating}★ {r.ClienteReview}")
            .ToList();

        if (misResenas.Count == 0)
            return BadRequest(new { error = "sin_resenas_propias" });

        // 2. Reseñas de competidores via Outscraper
        var competidoresData = new List<(string Nombre, List<string> Resenas)>();
        foreach (var comp in competidoresRes.Models)
        {
            var compResenas = await _outscraper.GetCompetitorReviewsAsync(comp.PlaceId, 20);
            var textos = compResenas
                .Where(r => !string.IsNullOrWhiteSpace(r.Text))
                .Select(r => $"{r.StarRating}★ {r.Text}")
                .ToList();
            competidoresData.Add((comp.Nombre, textos));
            _logger.LogInformation("[RadarController] Competidor {Nombre}: {Count} reseñas obtenidas", comp.Nombre, textos.Count);
        }

        // 3. Claude genera el análisis
        _logger.LogInformation("[RadarController] Lanzando análisis IA radar para negocio={NegocioId}", negocio!.Id);
        var resultJson = await _aiService.GenerateRadarAnalysisAsync(negocio.Nombre, misResenas, competidoresData);

        // 4. Guardar (conserva los 2 más recientes, borra el resto)
        var nuevo = new RadarAnalisisEntity
        {
            Id            = Guid.NewGuid(),
            NegocioId     = negocio.Id,
            ResultadoJson = resultJson,
            CreatedAt     = DateTimeOffset.UtcNow,
        };
        await _supabase.From<RadarAnalisisEntity>().Insert(nuevo);

        var allAfterInsert = await _supabase.From<RadarAnalisisEntity>()
            .Where(a => a.NegocioId == negocio.Id)
            .Order(a => a.CreatedAt, Postgrest.Constants.Ordering.Descending)
            .Get();
        foreach (var old in allAfterInsert.Models.Skip(2))
            await _supabase.From<RadarAnalisisEntity>().Where(a => a.Id == old.Id).Delete();

        _logger.LogInformation("[RadarController] Análisis radar guardado para negocio={NegocioId}", negocio.Id);

        return Ok(new
        {
            id              = nuevo.Id,
            createdAt       = nuevo.CreatedAt,
            resultado       = ParseAnalisisJson(resultJson),
            analisisEsteMes = thisMonthCount + 1,
        });
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private async Task<(NegocioEntity? Negocio, IActionResult? Error)> GetNegocioAndCheckPlanAsync()
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);

        var usuarioRes = await _supabase.From<UsuarioEntity>().Where(u => u.Id == userId).Limit(1).Get();
        var usuario    = usuarioRes.Models.FirstOrDefault();
        if (usuario == null) return (null, Unauthorized());

        var now = DateTimeOffset.UtcNow;
        var esProEfectivo = usuario.Plan == "pro" ||
            (usuario.ProOverride && (!usuario.ProOverrideHasta.HasValue || usuario.ProOverrideHasta.Value > now));

        if (!esProEfectivo)
            return (null, StatusCode(403, new { error = "plan_required", requiredPlan = "pro" }));

        var negocioRes = await _supabase.From<NegocioEntity>().Where(n => n.IdUsuario == userId).Limit(1).Get();
        var negocio    = negocioRes.Models.FirstOrDefault();
        if (negocio == null) return (null, NotFound("Negocio no encontrado."));

        return (negocio, null);
    }

    private static object? ParseAnalisisJson(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.Clone();   // Clone sobrevive al Dispose del doc
        }
        catch { return null; }
    }
}

public record AddCompetidorRequest(string PlaceId, string Nombre);
