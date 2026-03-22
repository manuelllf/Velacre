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
            var (profesional, colegueo, orgullosa) = await _aiService.GenerateThreeResponsesAsync(
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
                RespuestaColegueo = colegueo,
                RespuestaOrgullosa = orgullosa,
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
            return Ok(new GenerateReviewResponse(profesional, colegueo, orgullosa, saved.Id, saved.Codigo));
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

        var tone = negocio.TonoPredefinido.ToLower();

        var pending = reviewsResult.Models
            .Where(r => tone switch
            {
                "colegueo" => r.RespuestaColegueo == null,
                "orgullosa" => r.RespuestaOrgullosa == null,
                _ => r.RespuestaProfesional == null
            })
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
                respuestaColegueo = r.RespuestaColegueo,
                respuestaOrgullosa = r.RespuestaOrgullosa,
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
            "colegueo" => review.RespuestaColegueo,
            "orgullosa" => review.RespuestaOrgullosa,
            _ => review.RespuestaProfesional
        };

        if (!string.IsNullOrEmpty(alreadyGenerated))
        {
            _logger.LogInformation("[ReviewController] Tono {Tone} ya generado para reviewId={ReviewId}", tone, id);
            return Ok(new { response = alreadyGenerated, tono = tone });
        }

        _logger.LogDebug("[ReviewController] Generando respuesta para reviewId={ReviewId}, tono={Tone}", id, tone);

        try
        {
            var generated = await _aiService.GenerateSingleResponseAsync(
                review.ClienteReview,
                negocio.Descripcion ?? negocio.Nombre,
                tone
            );

            switch (toneLower)
            {
                case "colegueo":
                    review.RespuestaColegueo = generated;
                    break;
                case "orgullosa":
                    review.RespuestaOrgullosa = generated;
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
}
