using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using backend.Infrastructure;
using backend.Interfaces;
using backend.Models.Entities;
using System.Text.Json;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class RadarController : ControllerBase
{
    private readonly IUsuarioRepository _usuarioRepo;
    private readonly INegocioRepository _negocioRepo;
    private readonly IReviewRepository _reviewRepo;
    private readonly ICompetidorRepository _competidorRepo;
    private readonly IRadarAnalisisRepository _radarRepo;
    private readonly IOutscraperService _outscraper;
    private readonly IReviewAiService _aiService;
    private readonly ILogger<RadarController> _logger;

    private const int MaxCompetidores = 3;

    public RadarController(
        IUsuarioRepository usuarioRepo,
        INegocioRepository negocioRepo,
        IReviewRepository reviewRepo,
        ICompetidorRepository competidorRepo,
        IRadarAnalisisRepository radarRepo,
        IOutscraperService outscraper,
        IReviewAiService aiService,
        ILogger<RadarController> logger)
    {
        _usuarioRepo    = usuarioRepo;
        _negocioRepo    = negocioRepo;
        _reviewRepo     = reviewRepo;
        _competidorRepo = competidorRepo;
        _radarRepo      = radarRepo;
        _outscraper     = outscraper;
        _aiService      = aiService;
        _logger         = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetRadar()
    {
        var (negocio, errorResult) = await GetNegocioAndCheckPlanAsync();
        if (errorResult != null) return errorResult;

        var competidores = await _competidorRepo.GetByNegocioIdAsync(negocio!.Id);
        var analisis = await _radarRepo.GetByNegocioIdOrderedAsync(negocio.Id);

        var weekStart = GetIsoWeekStart(DateTimeOffset.UtcNow);
        var analisisEstaSemana = analisis.Count(a => a.CreatedAt >= weekStart);
        var ultimoAnalisis = analisis.FirstOrDefault();

        return Ok(new
        {
            competidores = competidores.Select(c => new
            {
                id        = c.Id,
                placeId   = c.PlaceId,
                nombre    = c.Nombre,
                createdAt = c.CreatedAt,
            }),
            analisisEstaSemana,
            ultimoAnalisis = ultimoAnalisis == null ? null : new
            {
                id        = ultimoAnalisis.Id,
                createdAt = ultimoAnalisis.CreatedAt,
                resultado = ParseAnalisisJson(ultimoAnalisis.ResultadoJson),
            }
        });
    }

    [HttpPost("competidores")]
    public async Task<IActionResult> AddCompetidor([FromBody] AddCompetidorRequest request)
    {
        var (negocio, errorResult) = await GetNegocioAndCheckPlanAsync();
        if (errorResult != null) return errorResult;

        var existing = await _competidorRepo.GetByNegocioIdAsync(negocio!.Id);

        if (existing.Count >= MaxCompetidores)
            return BadRequest(new { error = "max_competidores", max = MaxCompetidores });

        if (existing.Any(c => c.PlaceId == request.PlaceId))
            return BadRequest(new { error = "ya_existe" });

        var nuevo = new CompetidorEntity
        {
            Id         = Guid.NewGuid(),
            NegocioId  = negocio.Id,
            PlaceId    = request.PlaceId,
            Nombre     = request.Nombre.Trim(),
            CreatedAt  = DateTimeOffset.UtcNow,
        };

        await _competidorRepo.InsertAsync(nuevo);
        _logger.LogInformation("[RadarController] Competidor añadido: {Nombre} para negocio={NegocioId}", nuevo.Nombre, negocio.Id);

        return Ok(new { id = nuevo.Id, placeId = nuevo.PlaceId, nombre = nuevo.Nombre, createdAt = nuevo.CreatedAt });
    }

    [HttpDelete("competidores/{id:guid}")]
    public async Task<IActionResult> RemoveCompetidor(Guid id)
    {
        var (negocio, errorResult) = await GetNegocioAndCheckPlanAsync();
        if (errorResult != null) return errorResult;

        await _competidorRepo.DeleteAsync(id, negocio!.Id);
        return NoContent();
    }

    [HttpPost("analizar")]
    public async Task<IActionResult> Analizar()
    {
        var (negocio, errorResult) = await GetNegocioAndCheckPlanAsync();
        if (errorResult != null) return errorResult;

        var competidores = await _competidorRepo.GetByNegocioIdAsync(negocio!.Id);

        if (competidores.Count == 0)
            return BadRequest(new { error = "sin_competidores" });

        // Límite: 1 análisis por semana (ISO week, empieza lunes UTC)
        var weekStart = GetIsoWeekStart(DateTimeOffset.UtcNow);
        var allAnalysis = await _radarRepo.GetByNegocioIdOrderedAsync(negocio.Id);
        var thisWeekCount = allAnalysis.Count(a => a.CreatedAt >= weekStart);
        if (thisWeekCount >= 1)
            return StatusCode(429, new { error = "ya_analizado_esta_semana" });

        // 1. Reseñas propias desde BD
        var misResenasEntities = await _reviewRepo.GetByNegocioIdOrderedAsync(negocio.Id, 30);
        var misResenas = misResenasEntities
            .Where(r => !string.IsNullOrWhiteSpace(r.ClienteReview))
            .Select(r => $"{r.StarRating}★ {r.ClienteReview}")
            .ToList();

        if (misResenas.Count == 0)
            return BadRequest(new { error = "sin_resenas_propias" });

        // 2. Reseñas de competidores via Outscraper (en paralelo)
        var competidoresTasks = competidores.Select(async comp =>
        {
            var compResenas = await _outscraper.GetCompetitorReviewsAsync(comp.PlaceId, 20);
            var textos = compResenas
                .Where(r => !string.IsNullOrWhiteSpace(r.Text))
                .Select(r => $"{r.StarRating}★ {r.Text}")
                .ToList();
            _logger.LogInformation("[RadarController] Competidor {Nombre}: {Count} reseñas obtenidas", comp.Nombre, textos.Count);
            return (comp.Nombre, textos);
        }).ToList();
        var competidoresResults = await Task.WhenAll(competidoresTasks);
        var competidoresData = competidoresResults.ToList();

        // 3. Claude genera el análisis
        _logger.LogInformation("[RadarController] Lanzando análisis IA radar para negocio={NegocioId}", negocio.Id);
        var resultJson = await _aiService.GenerateRadarAnalysisAsync(negocio.Nombre, misResenas, competidoresData);

        // 4. Guardar (conserva los 2 más recientes, borra el resto)
        var nuevo = new RadarAnalisisEntity
        {
            Id            = Guid.NewGuid(),
            NegocioId     = negocio.Id,
            ResultadoJson = resultJson,
            CreatedAt     = DateTimeOffset.UtcNow,
        };
        await _radarRepo.InsertAsync(nuevo);

        var allAfterInsert = await _radarRepo.GetByNegocioIdOrderedAsync(negocio.Id);
        foreach (var old in allAfterInsert.Skip(2))
            await _radarRepo.DeleteAsync(old.Id);

        _logger.LogInformation("[RadarController] Análisis radar guardado para negocio={NegocioId}", negocio.Id);

        return Ok(new
        {
            id                  = nuevo.Id,
            createdAt           = nuevo.CreatedAt,
            resultado           = ParseAnalisisJson(resultJson),
            analisisEstaSemana  = thisWeekCount + 1,
        });
    }

    private async Task<(NegocioEntity? Negocio, IActionResult? Error)> GetNegocioAndCheckPlanAsync()
    {
        var userId = User.GetUserId();

        var usuario = await _usuarioRepo.GetByIdAsync(userId);
        if (usuario == null) return (null, Unauthorized());

        var now = DateTimeOffset.UtcNow;
        var esProEfectivo = usuario.Plan == "pro" ||
            (usuario.ProOverride && (!usuario.ProOverrideHasta.HasValue || usuario.ProOverrideHasta.Value > now));

        if (!esProEfectivo)
            return (null, StatusCode(403, new { error = "plan_required", requiredPlan = "pro" }));

        var negocio = await _negocioRepo.GetByUserIdAsync(userId);
        if (negocio == null) return (null, NotFound("Negocio no encontrado."));

        return (negocio, null);
    }

    private static object? ParseAnalisisJson(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.Clone();
        }
        catch { return null; }
    }

    // ISO 8601: la semana empieza el lunes. Devuelve 00:00 UTC del lunes de la semana actual.
    private static DateTimeOffset GetIsoWeekStart(DateTimeOffset now)
    {
        var dow = (int)now.DayOfWeek;            // 0=Sun, 1=Mon, ... 6=Sat
        var daysSinceMonday = (dow + 6) % 7;     // 0=Mon, 1=Tue, ... 6=Sun
        var monday = now.UtcDateTime.Date.AddDays(-daysSinceMonday);
        return new DateTimeOffset(monday, TimeSpan.Zero);
    }
}

public record AddCompetidorRequest(string PlaceId, string Nombre);
