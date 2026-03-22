using Microsoft.AspNetCore.Mvc;
using backend.Interfaces;
using backend.Models;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ReviewController : ControllerBase
{
    private readonly IReviewAiService _aiService;

    public ReviewController(IReviewAiService aiService)
    {
        _aiService = aiService;
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

        return Ok(new { response });
    }
}