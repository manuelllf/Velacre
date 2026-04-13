using Microsoft.AspNetCore.Mvc;
using backend.Interfaces;
using backend.Models.Entities;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CronController : ControllerBase
{
    private readonly INegocioRepository _negocioRepo;
    private readonly IReviewRepository _reviewRepo;
    private readonly IOutscraperService _outscraper;
    private readonly ILogger<CronController> _logger;
    private readonly string _cronSecret;

    public CronController(INegocioRepository negocioRepo, IReviewRepository reviewRepo, IOutscraperService outscraper, ILogger<CronController> logger)
    {
        _negocioRepo = negocioRepo;
        _reviewRepo = reviewRepo;
        _outscraper = outscraper;
        _logger = logger;
        _cronSecret = Environment.GetEnvironmentVariable("CRON_SECRET") ?? "";
    }

    [HttpPost("sync")]
    public async Task<IActionResult> SyncAll()
    {
        if (!string.IsNullOrEmpty(_cronSecret))
        {
            var provided = Request.Headers["X-Cron-Secret"].FirstOrDefault() ?? "";
            if (provided != _cronSecret)
            {
                _logger.LogWarning("[CronController] Petición rechazada: X-Cron-Secret inválido");
                return Unauthorized();
            }
        }

        _logger.LogInformation("[CronController] Iniciando sync semanal de reseñas");

        var negocios = await _negocioRepo.GetAllWithPlaceIdAsync();
        _logger.LogInformation("[CronController] {Count} negocios con place_id", negocios.Count);

        int totalNew = 0;
        int synced = 0;
        var errors = new List<string>();

        foreach (var negocio in negocios)
        {
            try
            {
                var existing = await _reviewRepo.GetByNegocioIdAsync(negocio.Id);

                var existingIds = existing
                    .Where(r => r.GoogleReviewId != null)
                    .Select(r => r.GoogleReviewId!)
                    .ToHashSet();

                DateTimeOffset? sinceDate = null;
                if (existing.Count > 0)
                {
                    var latest = existing
                        .Where(r => r.GoogleReviewId != null && r.ReviewDate.HasValue)
                        .Select(r => r.ReviewDate!.Value)
                        .DefaultIfEmpty()
                        .Max();
                    if (latest != default) sinceDate = latest;
                }

                var reviews = await _outscraper.GetReviewsAsync(negocio.PlaceId!, sinceDate);
                var ownerId = negocio.IdUsuario ?? negocio.CreadoPor;
                int newCount = 0;

                foreach (var review in reviews)
                {
                    if (existingIds.Contains(review.ReviewId)) continue;

                    var yaRespondida = !string.IsNullOrWhiteSpace(review.OwnerAnswer);
                    var entity = new ReviewEntity
                    {
                        Codigo         = "BFK" + Guid.NewGuid().ToString("N")[..7].ToUpper(),
                        IdNegocio      = negocio.Id,
                        GoogleReviewId = review.ReviewId,
                        AuthorName     = review.AuthorName,
                        StarRating     = review.StarRating,
                        ReviewDate     = review.PublishedAt,
                        ClienteReview  = review.Text,
                        ReviewLanguage = review.Language,
                        Estado         = yaRespondida ? "respondida" : "pendiente",
                        RespuestaProfesional = yaRespondida ? review.OwnerAnswer : null,
                        RespuestaCercano     = yaRespondida ? review.OwnerAnswer : null,
                        RespuestaDirecto     = yaRespondida ? review.OwnerAnswer : null,
                        TonoGenerado         = yaRespondida ? "google" : null,
                        CreadoPor            = ownerId,
                        CreadoFecha          = DateTimeOffset.UtcNow
                    };

                    await _reviewRepo.InsertAsync(entity);
                    newCount++;
                }

                totalNew += newCount;
                synced++;
                _logger.LogInformation("[CronController] Negocio {NegocioId}: {New} nuevas reseñas", negocio.Id, newCount);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[CronController] Error sync negocio {NegocioId}", negocio.Id);
                errors.Add(negocio.Id.ToString());
            }
        }

        _logger.LogInformation("[CronController] Sync completado: {Synced}/{Total} negocios, {New} nuevas reseñas, {Errors} errores",
            synced, negocios.Count, totalNew, errors.Count);

        return Ok(new { synced, total = negocios.Count, totalNew, errors });
    }
}
