namespace backend.Interfaces;

public interface IOutscraperService
{
    Task<List<OutscraperReview>> GetReviewsAsync(string placeId, int limit = 20);
}

public record OutscraperReview(
    string ReviewId,
    string AuthorName,
    int StarRating,
    string Text,
    DateTimeOffset PublishedAt
);
