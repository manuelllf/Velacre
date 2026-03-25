using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using backend.Interfaces;

namespace backend.Services;

public class GooglePlacesService : IGooglePlacesService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<GooglePlacesService> _logger;
    private readonly string _apiKey;

    public GooglePlacesService(HttpClient httpClient, ILogger<GooglePlacesService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
        _apiKey = Environment.GetEnvironmentVariable("GOOGLE_PLACES_API_KEY") ?? string.Empty;
    }

    public async Task<List<PlaceResult>> SearchPlacesAsync(string query)
    {
        _logger.LogInformation("[GooglePlacesService] SearchPlacesAsync — query={Query}", query);

        if (string.IsNullOrWhiteSpace(_apiKey))
        {
            _logger.LogWarning("[GooglePlacesService] GOOGLE_PLACES_API_KEY no configurada");
            return [];
        }

        var requestBody = JsonSerializer.Serialize(new
        {
            textQuery = query,
            languageCode = "es",
            locationBias = new
            {
                circle = new
                {
                    center = new { latitude = 42.88, longitude = -8.54 }, // Centro de Galicia
                    radius = 300000.0 // 300 km — cubre toda Galicia y alrededores
                }
            }
        });
        var request = new HttpRequestMessage(HttpMethod.Post, "https://places.googleapis.com/v1/places:searchText")
        {
            Content = new StringContent(requestBody, Encoding.UTF8, "application/json")
        };
        request.Headers.Add("X-Goog-Api-Key", _apiKey);
        request.Headers.Add("X-Goog-FieldMask", "places.id,places.displayName,places.formattedAddress,places.rating");

        try
        {
            var response = await _httpClient.SendAsync(request);
            var responseBody = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("[GooglePlacesService] SearchPlacesAsync falló: {Status} {Body}", response.StatusCode, responseBody);
                return [];
            }

            _logger.LogDebug("[GooglePlacesService] SearchPlacesAsync respuesta OK");

            var doc = JsonDocument.Parse(responseBody);
            var results = new List<PlaceResult>();

            if (!doc.RootElement.TryGetProperty("places", out var places))
                return results;

            foreach (var place in places.EnumerateArray())
            {
                var placeId = place.TryGetProperty("id", out var idProp) ? idProp.GetString() ?? string.Empty : string.Empty;
                var name = place.TryGetProperty("displayName", out var displayName) && displayName.TryGetProperty("text", out var nameProp)
                    ? nameProp.GetString() ?? string.Empty
                    : string.Empty;
                var address = place.TryGetProperty("formattedAddress", out var addrProp) ? addrProp.GetString() ?? string.Empty : string.Empty;
                double? rating = place.TryGetProperty("rating", out var ratingProp) ? ratingProp.GetDouble() : null;

                if (!string.IsNullOrEmpty(placeId))
                    results.Add(new PlaceResult(placeId, name, address, rating));
            }

            _logger.LogInformation("[GooglePlacesService] SearchPlacesAsync ← {Count} resultados", results.Count);
            return results;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[GooglePlacesService] Error en SearchPlacesAsync para query={Query}", query);
            return [];
        }
    }

    public async Task<List<GoogleReviewData>> GetReviewsAsync(string placeId)
    {
        _logger.LogInformation("[GooglePlacesService] GetReviewsAsync — placeId={PlaceId}", placeId);

        if (string.IsNullOrWhiteSpace(_apiKey))
        {
            _logger.LogWarning("[GooglePlacesService] GOOGLE_PLACES_API_KEY no configurada");
            return [];
        }

        var url = $"https://places.googleapis.com/v1/places/{placeId}?fields=reviews&languageCode=es";
        var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Add("X-Goog-Api-Key", _apiKey);

        try
        {
            var response = await _httpClient.SendAsync(request);
            var responseBody = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("[GooglePlacesService] GetReviewsAsync falló: {Status} {Body}", response.StatusCode, responseBody);
                return [];
            }

            _logger.LogDebug("[GooglePlacesService] GetReviewsAsync respuesta OK");

            var doc = JsonDocument.Parse(responseBody);
            var results = new List<GoogleReviewData>();

            if (!doc.RootElement.TryGetProperty("reviews", out var reviews))
                return results;

            foreach (var review in reviews.EnumerateArray())
            {
                var reviewId = review.TryGetProperty("name", out var nameProp) ? nameProp.GetString() ?? string.Empty : string.Empty;
                var rating = review.TryGetProperty("rating", out var ratingProp) ? ratingProp.GetInt32() : 0;
                var text = review.TryGetProperty("text", out var textObj) && textObj.TryGetProperty("text", out var textProp)
                    ? textProp.GetString() ?? string.Empty
                    : string.Empty;
                var authorName = review.TryGetProperty("authorAttribution", out var author) && author.TryGetProperty("displayName", out var displayNameProp)
                    ? displayNameProp.GetString() ?? string.Empty
                    : string.Empty;
                DateTimeOffset publishedAt = DateTimeOffset.UtcNow;
                if (review.TryGetProperty("publishTime", out var publishTimeProp) && publishTimeProp.GetString() is string publishTimeStr)
                    DateTimeOffset.TryParse(publishTimeStr, out publishedAt);

                if (!string.IsNullOrEmpty(reviewId))
                    results.Add(new GoogleReviewData(reviewId, authorName, rating, text, publishedAt));
            }

            _logger.LogInformation("[GooglePlacesService] GetReviewsAsync ← {Count} reseñas", results.Count);
            return results;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[GooglePlacesService] Error en GetReviewsAsync para placeId={PlaceId}", placeId);
            return [];
        }
    }
}
