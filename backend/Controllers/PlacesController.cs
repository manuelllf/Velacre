using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using backend.Interfaces;
using backend.Models.Entities;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PlacesController : ControllerBase
{
    private readonly IGooglePlacesService _placesService;
    private readonly IOutscraperService _outscraper;
    private readonly Supabase.Client _supabase;
    private readonly ILogger<PlacesController> _logger;

    public PlacesController(IGooglePlacesService placesService, IOutscraperService outscraper, Supabase.Client supabase, ILogger<PlacesController> logger)
    {
        _placesService = placesService;
        _outscraper = outscraper;
        _supabase = supabase;
        _logger = logger;
    }

    [HttpGet("search")]
    public async Task<IActionResult> SearchPlaces([FromQuery] string q)
    {
        if (string.IsNullOrWhiteSpace(q))
            return BadRequest("El parámetro 'q' es obligatorio.");

        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        _logger.LogInformation("[PlacesController] GET /search — userId={UserId}, q={Query}", userId, q);

        var results = await _placesService.SearchPlacesAsync(q);
        return Ok(results);
    }

    [HttpPost("sync")]
    public async Task<IActionResult> SyncReviews()
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        _logger.LogInformation("[PlacesController] POST /sync — userId={UserId}", userId);

        var negocioResult = await _supabase.From<NegocioEntity>()
            .Where(n => n.IdUsuario == userId)
            .Limit(1)
            .Get();

        var negocio = negocioResult.Models.FirstOrDefault();

        if (negocio == null)
        {
            _logger.LogWarning("[PlacesController] Negocio no encontrado para userId={UserId}", userId);
            return NotFound("No tienes ningún negocio registrado. Completa el onboarding primero.");
        }

        if (string.IsNullOrWhiteSpace(negocio.PlaceId))
        {
            _logger.LogWarning("[PlacesController] Negocio {NegocioId} no tiene place_id configurado", negocio.Id);
            return BadRequest("Tu negocio no tiene un Google Place ID configurado. Ve a Configuración para buscarlo.");
        }

        _logger.LogDebug("[PlacesController] Obteniendo reseñas para placeId={PlaceId}", negocio.PlaceId);

        var reviews = await _outscraper.GetReviewsAsync(negocio.PlaceId);

        // Obtener todas las reseñas importadas de Google que hay en la BD para este negocio
        var allExistingResult = await _supabase.From<ReviewEntity>()
            .Where(r => r.IdNegocio == negocio.Id)
            .Get();

        var currentReviewIds = reviews.Select(r => r.ReviewId).ToHashSet();

        // Borrar reseñas de Google que ya no pertenecen al place actual (negocio cambiado)
        var stale = allExistingResult.Models
            .Where(r => r.GoogleReviewId != null && !currentReviewIds.Contains(r.GoogleReviewId!))
            .ToList();

        foreach (var old in stale)
        {
            await _supabase.From<ReviewEntity>()
                .Where(r => r.Id == old.Id)
                .Delete();
            _logger.LogInformation("[PlacesController] Reseña obsoleta eliminada: {GoogleReviewId}", old.GoogleReviewId);
        }

        if (reviews.Count == 0)
        {
            _logger.LogInformation("[PlacesController] No se encontraron reseñas para placeId={PlaceId}", negocio.PlaceId);
            return Ok(new { newReviews = 0 });
        }

        int newCount = 0;

        foreach (var review in reviews)
        {
            var alreadyInDb = allExistingResult.Models
                .Any(r => r.GoogleReviewId == review.ReviewId);

            if (alreadyInDb)
            {
                _logger.LogDebug("[PlacesController] Reseña ya existe: {ReviewId}", review.ReviewId);
                continue;
            }

            var entity = new ReviewEntity
            {
                Codigo = "BFK" + Guid.NewGuid().ToString("N")[..7].ToUpper(),
                IdNegocio = negocio.Id,
                GoogleReviewId = review.ReviewId,
                AuthorName = review.AuthorName,
                StarRating = review.StarRating,
                ReviewDate = review.PublishedAt,
                ClienteReview = review.Text,
                CreadoPor = userId,
                CreadoFecha = DateTimeOffset.UtcNow
            };

            await _supabase.From<ReviewEntity>().Insert(entity);
            newCount++;
            _logger.LogDebug("[PlacesController] Reseña insertada: {Codigo}", entity.Codigo);
        }

        _logger.LogInformation("[PlacesController] Sincronización completada — {NewCount} nuevas, {StaleCount} obsoletas eliminadas para negocioId={NegocioId}", newCount, stale.Count, negocio.Id);
        return Ok(new { newReviews = newCount });
    }
}
