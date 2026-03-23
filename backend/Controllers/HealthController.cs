using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using backend.Interfaces;
using backend.Models.Entities;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class HealthController : ControllerBase
{
    private readonly IReviewAiService _aiService;
    private readonly Supabase.Client _supabase;
    private readonly ILogger<HealthController> _logger;

    public HealthController(IReviewAiService aiService, Supabase.Client supabase, ILogger<HealthController> logger)
    {
        _aiService = aiService;
        _supabase = supabase;
        _logger = logger;
    }

    [HttpPost("analysis")]
    public async Task<IActionResult> GetAnalysis()
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        _logger.LogInformation("[HealthController] POST /analysis — userId={UserId}", userId);

        var negocioResult = await _supabase.From<NegocioEntity>()
            .Where(n => n.IdUsuario == userId)
            .Limit(1)
            .Get();

        var negocio = negocioResult.Models.FirstOrDefault();
        if (negocio == null)
            return NotFound("No tienes ningún negocio registrado.");

        var reviewsResult = await _supabase.From<ReviewEntity>()
            .Where(r => r.IdNegocio == negocio.Id)
            .Get();

        var reviews = reviewsResult.Models;

        if (reviews.Count == 0)
        {
            return Ok(new
            {
                brillante = "Aún no tienes reseñas para analizar.",
                preocupa = "—",
                accion = "Sincroniza tus reseñas de Google para empezar."
            });
        }

        var reviewSummary = string.Join("\n", reviews
            .Take(50)
            .Select(r => $"[{r.StarRating ?? 0}★] {r.ClienteReview}"));

        var prompt = $"Analiza estas reseñas de un negocio español (hostelería en Galicia) y responde SOLO con un JSON válido con este formato exacto: {{\"brillante\": \"frase corta sobre lo que mejor valoran los clientes\", \"preocupa\": \"frase corta sobre el problema principal\", \"accion\": \"acción concreta y específica que puede mejorar la nota\"}}.\n\nReseñas:\n{reviewSummary}";

        try
        {
            var response = await _aiService.GetClaudeMessageAsync(prompt, "");
            var start = response.IndexOf('{');
            var end = response.LastIndexOf('}');
            if (start >= 0 && end > start)
            {
                var json = response[start..(end + 1)];
                var parsed = System.Text.Json.JsonDocument.Parse(json);
                return Ok(parsed);
            }
            return Ok(new { brillante = response, preocupa = "—", accion = "—" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[HealthController] Error generando análisis para userId={UserId}", userId);
            return StatusCode(500, "Error generando análisis");
        }
    }
}
