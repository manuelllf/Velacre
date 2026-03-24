namespace backend.Interfaces;

public interface IOutscraperService
{
    /// <summary>
    /// sinceDate = null → carga inicial (100 reviews, sin cutoff)
    /// sinceDate = fecha → sync incremental (solo nuevas desde esa fecha)
    /// </summary>
    Task<List<OutscraperReview>> GetReviewsAsync(string placeId, DateTimeOffset? sinceDate = null);
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
