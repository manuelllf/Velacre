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

        var negocio = await _supabase.From<NegocioEntity>()
            .Where(n => n.IdUsuario == userId)
            .Single();

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
}
