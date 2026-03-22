using Microsoft.AspNetCore.Mvc;
using backend.Interfaces;
using backend.Models;
using backend.Models.Entities;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
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
    public async Task<IActionResult> GenerateResponse([FromBody] ReviewRequest request)
    {
        if (string.IsNullOrEmpty(request.ReviewText))
            return BadRequest("La reseña no puede estar vacía.");

        var response = await _aiService.GenerateResponseAsync(
            request.ReviewText,
            request.BusinessTone,
            request.BusinessDescription
        );

        var entity = new ReviewEntity
        {
            IdNegocio = Guid.Parse("12eb9bdc-8e59-4fb1-8e13-529445884911"),
            ClienteReview = request.ReviewText,
            RespuestaIA = response,
            Tono = request.BusinessTone,
            CreadoPor = Guid.Empty,
            CreadoFecha = DateTimeOffset.UtcNow
        };

        var result = await _supabase.From<ReviewEntity>().Insert(entity);

        if (result.Models.Count == 0)
            return StatusCode(500, "La IA generó la respuesta pero no se pudo guardar en la base de datos.");

        return Ok(new { response, id = result.Models[0].Id, codigo = result.Models[0].Codigo });
    }
}
