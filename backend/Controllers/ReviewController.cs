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

    public ReviewController(IReviewAiService aiService, Supabase.Client supabase)
    {
        _aiService = aiService;
        _supabase = supabase;
    }

    [HttpPost("generate")]
    public async Task<IActionResult> GenerateResponse([FromBody] GenerateReviewRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.ReviewText))
            return BadRequest("La reseña no puede estar vacía.");

        var userId = Guid.Parse(User.FindFirst("sub")!.Value);

        var negocio = await _supabase.From<NegocioEntity>()
            .Where(n => n.IdUsuario == userId)
            .Single();

        if (negocio == null)
            return NotFound("No tienes ningún negocio registrado. Completa el onboarding primero.");

        var (profesional, colegueo, orgullosa) = await _aiService.GenerateThreeResponsesAsync(
            request.ReviewText,
            negocio.Descripcion ?? negocio.Nombre
        );

        var entity = new ReviewEntity
        {
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
            return StatusCode(500, "Las respuestas se generaron pero no se pudieron guardar.");

        var saved = result.Models[0];
        return Ok(new GenerateReviewResponse(profesional, colegueo, orgullosa, saved.Id, saved.Codigo));
    }
}
