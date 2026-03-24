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

        // Obtener reseñas existentes en BD para este negocio
        var allExistingResult = await _supabase.From<ReviewEntity>()
            .Where(r => r.IdNegocio == negocio.Id)
            .Get();

        var existingGoogleIds = allExistingResult.Models
            .Where(r => r.GoogleReviewId != null)
            .Select(r => r.GoogleReviewId!)
            .ToHashSet();

        // Lógica dual: sin reseñas previas → carga inicial (100), si hay → incremental (cutoff)
        DateTimeOffset? sinceDate = null;
        if (allExistingResult.Models.Count > 0)
        {
            var latestReviewDate = allExistingResult.Models
                .Where(r => r.GoogleReviewId != null && r.ReviewDate.HasValue)
                .Select(r => r.ReviewDate!.Value)
                .DefaultIfEmpty()
                .Max();

            if (latestReviewDate != default)
                sinceDate = latestReviewDate;
        }

        bool isInitialLoad = sinceDate == null;
        _logger.LogInformation("[PlacesController] Modo sync: {Mode} para negocioId={NegocioId}, sinceDate={Since}",
            isInitialLoad ? "INICIAL" : "INCREMENTAL", negocio.Id, sinceDate?.ToString("yyyy-MM-dd") ?? "—");

        var reviews = await _outscraper.GetReviewsAsync(negocio.PlaceId, sinceDate);

        // En carga inicial: eliminar reseñas de Google que ya no están en el place (negocio cambiado)
        int staleCount = 0;
        if (isInitialLoad && reviews.Count > 0)
        {
            var incomingIds = reviews.Select(r => r.ReviewId).ToHashSet();
            var stale = allExistingResult.Models
                .Where(r => r.GoogleReviewId != null && !incomingIds.Contains(r.GoogleReviewId!))
                .ToList();

            foreach (var old in stale)
            {
                await _supabase.From<ReviewEntity>().Where(r => r.Id == old.Id).Delete();
                _logger.LogInformation("[PlacesController] Reseña obsoleta eliminada: {GoogleReviewId}", old.GoogleReviewId);
                staleCount++;
            }
        }

        if (reviews.Count == 0)
        {
            _logger.LogInformation("[PlacesController] Sin nuevas reseñas para placeId={PlaceId}", negocio.PlaceId);
            return Ok(new { newReviews = 0 });
        }

        int newCount = 0;

        foreach (var review in reviews)
        {
            // Deduplicación: saltar si ya existe por google_review_id
            if (existingGoogleIds.Contains(review.ReviewId))
            {
                _logger.LogDebug("[PlacesController] Ya existe: {ReviewId}", review.ReviewId);
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
                CreadoPor            = userId,
                CreadoFecha          = DateTimeOffset.UtcNow
            };

            await _supabase.From<ReviewEntity>().Insert(entity);
            newCount++;
            _logger.LogDebug("[PlacesController] Reseña insertada: {Codigo} ({ReviewId})", entity.Codigo, review.ReviewId);
        }

        _logger.LogInformation("[PlacesController] Sync completado — {NewCount} nuevas, {StaleCount} obsoletas, modo={Mode}, negocioId={NegocioId}",
            newCount, staleCount, isInitialLoad ? "inicial" : "incremental", negocio.Id);
        return Ok(new { newReviews = newCount });
    }
}
