using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using backend.Infrastructure;
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
    private readonly IGoogleBusinessService _gbp;
    private readonly INegocioRepository _negocioRepo;
    private readonly IReviewRepository _reviewRepo;
    private readonly ILogger<PlacesController> _logger;

    public PlacesController(
        IGooglePlacesService placesService,
        IOutscraperService outscraper,
        IGoogleBusinessService gbp,
        INegocioRepository negocioRepo,
        IReviewRepository reviewRepo,
        ILogger<PlacesController> logger)
    {
        _placesService = placesService;
        _outscraper    = outscraper;
        _gbp           = gbp;
        _negocioRepo   = negocioRepo;
        _reviewRepo    = reviewRepo;
        _logger        = logger;
    }

    [HttpGet("search")]
    public async Task<IActionResult> SearchPlaces([FromQuery] string q)
    {
        if (string.IsNullOrWhiteSpace(q))
            return BadRequest("El parámetro 'q' es obligatorio.");

        var userId = User.GetUserId();
        _logger.LogInformation("[PlacesController] GET /search — userId={UserId}, q={Query}", userId, q);

        var results = await _placesService.SearchPlacesAsync(q);
        return Ok(results);
    }

    [HttpPost("sync")]
    public async Task<IActionResult> SyncReviews()
    {
        var userId = User.GetUserId();
        _logger.LogInformation("[PlacesController] POST /sync — userId={UserId}", userId);

        var negocio = await _negocioRepo.GetByUserIdAsync(userId);

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

        var allExisting = await _reviewRepo.GetByNegocioIdAsync(negocio.Id);

        var existingGoogleIds = allExisting
            .Where(r => r.GoogleReviewId != null)
            .Select(r => r.GoogleReviewId!)
            .ToHashSet();

        DateTimeOffset? sinceDate = null;
        if (allExisting.Count > 0)
        {
            var latestReviewDate = allExisting
                .Where(r => r.GoogleReviewId != null && r.ReviewDate.HasValue)
                .Select(r => r.ReviewDate!.Value)
                .DefaultIfEmpty()
                .Max();

            if (latestReviewDate != default)
                sinceDate = latestReviewDate;
        }

        bool isInitialLoad = sinceDate == null;

        var gbpConnection = await _gbp.GetConnectionAsync(negocio.Id);
        if (gbpConnection != null)
        {
            _logger.LogInformation("[PlacesController] Sync via GBP API para negocioId={NegocioId}", negocio.Id);
            var (gbpNew, gbpUpdated) = await _gbp.SyncReviewsAsync(negocio.Id, userId);
            return Ok(new { newReviews = gbpNew, updatedReviews = gbpUpdated, source = "gbp" });
        }

        _logger.LogInformation("[PlacesController] Modo sync Outscraper: {Mode} para negocioId={NegocioId}, sinceDate={Since}",
            isInitialLoad ? "INICIAL" : "INCREMENTAL", negocio.Id, sinceDate?.ToString("yyyy-MM-dd") ?? "—");

        var reviews = await _outscraper.GetReviewsAsync(negocio.PlaceId, sinceDate);

        if (reviews.Count == 0)
        {
            _logger.LogInformation("[PlacesController] Sin nuevas reseñas para placeId={PlaceId}", negocio.PlaceId);
            return Ok(new { newReviews = 0 });
        }

        int newCount = 0;
        int updatedCount = 0;

        var existingByGoogleId = allExisting
            .Where(r => r.GoogleReviewId != null)
            .ToDictionary(r => r.GoogleReviewId!, r => r);

        foreach (var review in reviews)
        {
            if (existingGoogleIds.Contains(review.ReviewId))
            {
                if (!string.IsNullOrWhiteSpace(review.OwnerAnswer) &&
                    existingByGoogleId.TryGetValue(review.ReviewId, out var existing) &&
                    existing.TonoGenerado != "google")
                {
                    existing.RespuestaProfesional = review.OwnerAnswer;
                    existing.RespuestaCercano     = review.OwnerAnswer;
                    existing.RespuestaDirecto     = review.OwnerAnswer;
                    existing.TonoGenerado         = "google";
                    existing.Estado               = "respondida";
                    existing.ActualizadoPor        = userId;
                    existing.ActualizadoFecha      = DateTimeOffset.UtcNow;
                    await _reviewRepo.UpdateAsync(existing);
                    updatedCount++;
                }
                continue;
            }

            var yaRespondida = !string.IsNullOrWhiteSpace(review.OwnerAnswer);
            var entity = new ReviewEntity
            {
                Codigo               = "BFK" + Guid.NewGuid().ToString("N")[..7].ToUpper(),
                IdNegocio            = negocio.Id,
                GoogleReviewId       = review.ReviewId,
                AuthorName           = review.AuthorName,
                StarRating           = review.StarRating,
                ReviewDate           = review.PublishedAt,
                ClienteReview        = review.Text,
                ReviewLanguage       = review.Language,
                RespuestaProfesional = yaRespondida ? review.OwnerAnswer : null,
                RespuestaCercano     = yaRespondida ? review.OwnerAnswer : null,
                RespuestaDirecto     = yaRespondida ? review.OwnerAnswer : null,
                TonoGenerado         = yaRespondida ? "google" : null,
                Estado               = yaRespondida ? "respondida" : "pendiente",
                CreadoPor            = userId,
                CreadoFecha          = DateTimeOffset.UtcNow
            };

            await _reviewRepo.InsertAsync(entity);
            newCount++;
        }

        _logger.LogInformation("[PlacesController] Sync completado — {NewCount} nuevas, {UpdatedCount} actualizadas, modo={Mode}, negocioId={NegocioId}",
            newCount, updatedCount, isInitialLoad ? "inicial" : "incremental", negocio.Id);
        return Ok(new { newReviews = newCount, updatedReviews = updatedCount });
    }
}
