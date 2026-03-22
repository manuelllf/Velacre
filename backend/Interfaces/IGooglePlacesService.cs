namespace backend.Interfaces;

public interface IGooglePlacesService
{
    Task<List<PlaceResult>> SearchPlacesAsync(string query);
    Task<List<GoogleReviewData>> GetReviewsAsync(string placeId);
}

public record PlaceResult(string PlaceId, string Name, string Address, double? Rating);
public record GoogleReviewData(string ReviewId, string AuthorName, int StarRating, string Text, DateTimeOffset PublishedAt);
