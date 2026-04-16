namespace backend.Interfaces;

public interface IOutscraperService
{
    /// <summary>
    /// sinceDate = null → carga inicial (100 reviews, sin cutoff)
    /// sinceDate = fecha → sync incremental (solo nuevas desde esa fecha)
    /// </summary>
    Task<List<OutscraperReview>> GetReviewsAsync(string placeId, DateTimeOffset? sinceDate = null);

    /// <summary>Obtiene las últimas N reseñas de un competidor para análisis comparativo.</summary>
    Task<List<OutscraperReview>> GetCompetitorReviewsAsync(string placeId, int limit = 20);

    /// <summary>
    /// Reseñas publicadas en los últimos N días (filtrado server-side por cutoff + defensa client-side).
    /// Usado por el Mini Radar (prospección B2B) para calcular métricas reales: tasa de respuesta,
    /// volumen del último mes, etc. Mapeo completo incluyendo owner_answer.
    /// </summary>
    Task<List<OutscraperReview>> GetRecentReviewsAsync(string placeId, int dias = 30, int maxReviews = 200);
}

public record OutscraperReview(
    string ReviewId,
    string AuthorName,
    int StarRating,
    string Text,
    DateTimeOffset PublishedAt,
    string? OwnerAnswer = null,
    string? Language = null
);
