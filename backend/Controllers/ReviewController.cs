using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using backend.Interfaces;
using backend.Models.Entities;
using backend.Models.Requests;
using backend.Models.Responses;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ReviewController : ControllerBase
{
    private readonly IReviewAiService _aiService;
    private readonly Supabase.Client _supabase;
    private readonly ILogger<ReviewController> _logger;

    public ReviewController(IReviewAiService aiService, Supabase.Client supabase, ILogger<ReviewController> logger)
    {
        _aiService = aiService;
        _supabase = supabase;
        _logger = logger;
    }

    [HttpPost("generate")]
    public async Task<IActionResult> GenerateResponse([FromBody] GenerateReviewRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.ReviewText))
            return BadRequest("La reseña no puede estar vacía.");

        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        _logger.LogInformation("[ReviewController] POST /generate — userId={UserId}, plataforma={Plataforma}", userId, request.Plataforma);

        // Check plan limits for manual generation
        var usuarioResult = await _supabase.From<UsuarioEntity>()
            .Where(u => u.Id == userId)
            .Limit(1)
            .Get();

        var usuario = usuarioResult.Models.FirstOrDefault();

        if (usuario != null && usuario.Plan == "basic")
        {
            var now = DateTimeOffset.UtcNow;
            // Reset counter if it's a new month
            if (usuario.RespuestasMesReset == null ||
                usuario.RespuestasMesReset.Value.Year < now.Year ||
                (usuario.RespuestasMesReset.Value.Year == now.Year && usuario.RespuestasMesReset.Value.Month < now.Month))
            {
                usuario.RespuestasManualesMes = 0;
                await _supabase.From<UsuarioEntity>().Where(u => u.Id == userId).Update(usuario);
            }

            if (usuario.RespuestasManualesMes >= 30)
            {
                _logger.LogWarning("[ReviewController] Usuario {UserId} alcanzó límite de 30 respuestas manuales en plan basic", userId);
                return StatusCode(403, "Has alcanzado el límite de 30 respuestas manuales este mes. Actualiza a Pro para respuestas ilimitadas.");
            }
        }

        var negocioResult = await _supabase.From<NegocioEntity>()
            .Where(n => n.IdUsuario == userId)
            .Limit(1)
            .Get();

        var negocio = negocioResult.Models.FirstOrDefault();

        if (negocio == null)
        {
            _logger.LogWarning("[ReviewController] userId={UserId} no tiene negocio registrado", userId);
            return NotFound("No tienes ningún negocio registrado. Completa el onboarding primero.");
        }

        _logger.LogDebug("[ReviewController] Generando respuestas para negocio={NegocioId}", negocio.Id);

        try
        {
            var (profesional, cercano, directo) = await _aiService.GenerateThreeResponsesAsync(
                request.ReviewText,
                negocio.Descripcion ?? negocio.Nombre
            );

            _logger.LogInformation("[ReviewController] Respuestas generadas OK, guardando en BD...");

            var entity = new ReviewEntity
            {
                Codigo = "BFK" + Guid.NewGuid().ToString("N")[..7].ToUpper(),
                IdNegocio = negocio.Id,
                ClienteReview = request.ReviewText,
                RespuestaProfesional = profesional,
                RespuestaCercano = cercano,
                RespuestaDirecto = directo,
                Plataforma = request.Plataforma,
                CreadoPor = userId,
                CreadoFecha = DateTimeOffset.UtcNow
            };

            var result = await _supabase.From<ReviewEntity>().Insert(entity);

            if (result.Models.Count == 0)
            {
                _logger.LogError("[ReviewController] Insert de review devolvió 0 modelos, negocioId={NegocioId}", negocio.Id);
                return StatusCode(500, "Las respuestas se generaron pero no se pudieron guardar.");
            }

            var saved = result.Models[0];
            _logger.LogInformation("[ReviewController] Review guardada: {ReviewId} ({Codigo})", saved.Id, saved.Codigo);

            // Increment monthly counter for basic plan users
            if (usuario != null && usuario.Plan == "basic")
            {
                usuario.RespuestasManualesMes += 1;
                if (usuario.RespuestasMesReset == null) usuario.RespuestasMesReset = DateTimeOffset.UtcNow;
                await _supabase.From<UsuarioEntity>().Where(u => u.Id == userId).Update(usuario);
                _logger.LogDebug("[ReviewController] Contador manual incrementado → {Count}/30 para userId={UserId}", usuario.RespuestasManualesMes, userId);
            }

            return Ok(new GenerateReviewResponse(profesional, cercano, directo, saved.Id, saved.Codigo));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[ReviewController] Error al generar/guardar review para userId={UserId}", userId);
            return StatusCode(500, ex.Message);
        }
    }

    [HttpGet("pending")]
    public async Task<IActionResult> GetPendingReviews()
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        _logger.LogInformation("[ReviewController] GET /pending — userId={UserId}", userId);

        var negocioResult = await _supabase.From<NegocioEntity>()
            .Where(n => n.IdUsuario == userId)
            .Limit(1)
            .Get();

        var negocio = negocioResult.Models.FirstOrDefault();

        if (negocio == null)
        {
            _logger.LogWarning("[ReviewController] userId={UserId} no tiene negocio registrado", userId);
            return NotFound("No tienes ningún negocio registrado. Completa el onboarding primero.");
        }

        var reviewsResult = await _supabase.From<ReviewEntity>()
            .Where(r => r.IdNegocio == negocio.Id)
            .Get();

        var pending = reviewsResult.Models
            .Where(r => r.RespuestaProfesional == null && r.RespuestaCercano == null && r.RespuestaDirecto == null)
            .OrderByDescending(r => r.ReviewDate ?? r.CreadoFecha)
            .Select(r => new
            {
                id = r.Id,
                googleReviewId = r.GoogleReviewId,
                authorName = r.AuthorName,
                starRating = r.StarRating,
                reviewDate = r.ReviewDate ?? r.CreadoFecha,
                clientereview = r.ClienteReview,
                respuestaProfesional = r.RespuestaProfesional,
                respuestaCercano = r.RespuestaCercano,
                respuestaDirecto = r.RespuestaDirecto,
                tonoGenerado = r.TonoGenerado
            })
            .ToList();

        _logger.LogInformation("[ReviewController] GET /pending ← {Count} reseñas pendientes para negocioId={NegocioId}", pending.Count, negocio.Id);
        return Ok(pending);
    }

    [HttpPost("{id}/generate")]
    public async Task<IActionResult> GenerateForReview(Guid id)
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        _logger.LogInformation("[ReviewController] POST /{ReviewId}/generate — userId={UserId}", id, userId);

        var negocioResult = await _supabase.From<NegocioEntity>()
            .Where(n => n.IdUsuario == userId)
            .Limit(1)
            .Get();

        var negocio = negocioResult.Models.FirstOrDefault();

        if (negocio == null)
        {
            _logger.LogWarning("[ReviewController] userId={UserId} no tiene negocio registrado", userId);
            return NotFound("No tienes ningún negocio registrado. Completa el onboarding primero.");
        }

        var reviewResult = await _supabase.From<ReviewEntity>()
            .Where(r => r.Id == id && r.IdNegocio == negocio.Id)
            .Limit(1)
            .Get();

        var review = reviewResult.Models.FirstOrDefault();

        if (review == null)
        {
            _logger.LogWarning("[ReviewController] Reseña {ReviewId} no encontrada para negocioId={NegocioId}", id, negocio.Id);
            return NotFound("Reseña no encontrada.");
        }

        var tone = negocio.TonoPredefinido;
        var toneLower = tone.ToLower();

        // Only generate if that tone field is still null
        var alreadyGenerated = toneLower switch
        {
            "cercano" => review.RespuestaCercano,
            "directo" => review.RespuestaDirecto,
            _ => review.RespuestaProfesional
        };

        if (!string.IsNullOrEmpty(alreadyGenerated))
        {
            _logger.LogInformation("[ReviewController] Tono {Tone} ya generado para reviewId={ReviewId}", tone, id);
            return Ok(new { response = alreadyGenerated, tono = tone });
        }

        _logger.LogDebug("[ReviewController] Generando respuesta para reviewId={ReviewId}, tono={Tone}", id, tone);

        // Build review context — use star rating when text is absent
        var reviewContext = !string.IsNullOrWhiteSpace(review.ClienteReview)
            ? review.ClienteReview
            : review.StarRating.HasValue
                ? $"[Reseña sin texto] {review.StarRating} estrella{(review.StarRating != 1 ? "s" : "")} de {review.AuthorName ?? "un cliente"}. No dejó comentario escrito."
                : $"[Reseña sin texto] de {review.AuthorName ?? "un cliente"}. No dejó comentario escrito.";

        try
        {
            var generated = await _aiService.GenerateSingleResponseAsync(
                reviewContext,
                negocio.Descripcion ?? negocio.Nombre,
                tone
            );

            switch (toneLower)
            {
                case "cercano":
                    review.RespuestaCercano = generated;
                    break;
                case "directo":
                    review.RespuestaDirecto = generated;
                    break;
                default:
                    review.RespuestaProfesional = generated;
                    break;
            }
            review.TonoGenerado = tone;
            review.ActualizadoPor = userId;
            review.ActualizadoFecha = DateTimeOffset.UtcNow;

            await _supabase.From<ReviewEntity>()
                .Where(r => r.Id == review.Id)
                .Update(review);

            _logger.LogInformation("[ReviewController] Respuesta generada y guardada para reviewId={ReviewId}", id);
            return Ok(new { response = generated, tono = tone });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[ReviewController] Error generando respuesta para reviewId={ReviewId}", id);
            return StatusCode(500, ex.Message);
        }
    }

    [HttpGet("all")]
    public async Task<IActionResult> GetAllReviews()
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);

        var negocioResult = await _supabase.From<NegocioEntity>()
            .Where(n => n.IdUsuario == userId).Limit(1).Get();
        var negocio = negocioResult.Models.FirstOrDefault();
        if (negocio == null) return NotFound();

        var reviewsResult = await _supabase.From<ReviewEntity>()
            .Where(r => r.IdNegocio == negocio.Id).Get();

        var all = reviewsResult.Models
            .OrderByDescending(r => r.ReviewDate ?? r.CreadoFecha)
            .Select(r => new
            {
                id = r.Id,
                googleReviewId = r.GoogleReviewId,
                authorName = r.AuthorName,
                starRating = r.StarRating,
                reviewDate = r.ReviewDate ?? r.CreadoFecha,
                clientereview = r.ClienteReview,
                respuestaProfesional = r.RespuestaProfesional,
                respuestaCercano = r.RespuestaCercano,
                respuestaDirecto = r.RespuestaDirecto,
                tonoGenerado = r.TonoGenerado,
            })
            .ToList();

        return Ok(all);
    }

    [HttpPost("{id}/translate")]
    public async Task<IActionResult> TranslateReview(Guid id)
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);

        var negocioResult = await _supabase.From<NegocioEntity>().Where(n => n.IdUsuario == userId).Limit(1).Get();
        var negocio = negocioResult.Models.FirstOrDefault();
        if (negocio == null) return NotFound();

        var reviewResult = await _supabase.From<ReviewEntity>()
            .Where(r => r.Id == id && r.IdNegocio == negocio.Id)
            .Limit(1).Get();
        var review = reviewResult.Models.FirstOrDefault();
        if (review == null) return NotFound("Reseña no encontrada.");

        if (string.IsNullOrWhiteSpace(review.ClienteReview))
            return BadRequest("La reseña no tiene texto para traducir.");

        var prompt = $"Traduce al español este texto de una reseña de cliente. Devuelve SOLO la traducción, sin explicaciones ni comillas:\n\n{review.ClienteReview}";

        try
        {
            var translation = await _aiService.GetClaudeMessageAsync(prompt, "");
            return Ok(new { translation = translation.Trim() });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[ReviewController] Error traduciendo reviewId={ReviewId}", id);
            return StatusCode(500, "Error al traducir la reseña.");
        }
    }

    /// <summary>
    /// Métricas de rentabilidad Velacre.
    /// is_velacre_response = tonoGenerado != null AND tonoGenerado != "google"
    /// No necesita columna nueva: tonoGenerado ya captura el origen de la respuesta.
    /// </summary>
    [HttpGet("metrics")]
    public async Task<IActionResult> GetMetrics()
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        var negocioResult = await _supabase.From<NegocioEntity>().Where(n => n.IdUsuario == userId).Limit(1).Get();
        var negocio = negocioResult.Models.FirstOrDefault();
        if (negocio == null) return NotFound();

        var reviewsResult = await _supabase.From<ReviewEntity>().Where(r => r.IdNegocio == negocio.Id).Get();
        var reviews = reviewsResult.Models;

        var total = reviews.Count;
        var velacreCount = reviews.Count(r => r.TonoGenerado != null && r.TonoGenerado != "google");
        var timeSavedMinutes = velacreCount * 4;

        // Tasa de respuesta: histórico (antes de los últimos 3 meses) vs reciente
        var cutoff = DateTimeOffset.UtcNow.AddMonths(-3);
        var recent = reviews.Where(r => r.ReviewDate >= cutoff).ToList();
        var historic = reviews.Where(r => r.ReviewDate < cutoff).ToList();

        double currentRate = recent.Count > 0
            ? (double)recent.Count(r => r.TonoGenerado != null) / recent.Count * 100 : 0;
        double historicRate = historic.Count > 0
            ? (double)historic.Count(r => r.TonoGenerado != null) / historic.Count * 100 : 0;

        return Ok(new
        {
            total,
            velacreCount,
            timeSavedMinutes,
            currentResponseRate = Math.Round(currentRate, 1),
            historicResponseRate = Math.Round(historicRate, 1),
            improvement = Math.Round(currentRate - historicRate, 1)
        });
    }

    [HttpPost("summary")]
    public async Task<IActionResult> GetSummary()
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        var negocioResult = await _supabase.From<NegocioEntity>().Where(n => n.IdUsuario == userId).Limit(1).Get();
        var negocio = negocioResult.Models.FirstOrDefault();
        if (negocio == null) return NotFound();

        var reviewsResult = await _supabase.From<ReviewEntity>().Where(r => r.IdNegocio == negocio.Id).Get();
        var reviews = reviewsResult.Models;

        if (reviews.Count == 0) return Ok(new { brilla = "Aún no tienes reseñas para analizar.", quema = "—", accion = "Sincroniza tus reseñas de Google para empezar." });

        var reviewSummary = string.Join("\n", reviews.Take(50).Select(r => $"[{r.StarRating}★] {r.ClienteReview}"));
        var prompt = $"Analiza estas reseñas de un negocio español y responde SOLO con un JSON válido con este formato exacto: {{\"brilla\": \"frase corta sobre lo mejor\", \"quema\": \"frase corta sobre el problema principal\", \"accion\": \"acción concreta con métrica si puedes\"}}.\n\nReseñas:\n{reviewSummary}";

        try
        {
            var response = await _aiService.GetClaudeMessageAsync(prompt, "");
            // Try to extract JSON from response
            var start = response.IndexOf('{');
            var end = response.LastIndexOf('}');
            if (start >= 0 && end > start)
            {
                var json = response[start..(end + 1)];
                var parsed = System.Text.Json.JsonDocument.Parse(json);
                return Ok(parsed);
            }
            return Ok(new { brilla = response, quema = "—", accion = "—" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[ReviewController] Error getting summary");
            return StatusCode(500, "Error generando resumen");
        }
    }
}
