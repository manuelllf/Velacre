using System.Text.Json;
using backend.Interfaces;

namespace backend.Services;

public class OutscraperService : IOutscraperService
{
    private readonly HttpClient _http;
    private readonly ILogger<OutscraperService> _logger;
    private readonly string _apiKey;

    public OutscraperService(HttpClient http, ILogger<OutscraperService> logger)
    {
        _http = http;
        _logger = logger;
        _apiKey = Environment.GetEnvironmentVariable("OUTSCRAPER_API_KEY") ?? "";

        if (!string.IsNullOrWhiteSpace(_apiKey))
            _logger.LogInformation("[OutscraperService] OUTSCRAPER_API_KEY está configurada");
        else
            _logger.LogWarning("[OutscraperService] OUTSCRAPER_API_KEY NO está configurada");
    }

    public async Task<List<OutscraperReview>> GetReviewsAsync(string placeId, int limit = 20)
    {
        _logger.LogInformation("[OutscraperService] GetReviewsAsync — placeId={PlaceId}, limit={Limit}", placeId, limit);

        if (string.IsNullOrEmpty(_apiKey))
        {
            _logger.LogWarning("[OutscraperService] OUTSCRAPER_API_KEY not set");
            return [];
        }

        var url = $"https://api.app.outscraper.com/maps/reviews-v3?query={Uri.EscapeDataString(placeId)}&reviewsLimit={limit}&language=es&sort=newest&async=false";
        var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Add("X-API-KEY", _apiKey);

        try
        {
            var response = await _http.SendAsync(request);
            var body = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("[OutscraperService] Error {Status}: {Body}", response.StatusCode, body);
                return [];
            }

            var json = JsonDocument.Parse(body);
            var results = new List<OutscraperReview>();

            // Response structure: { "data": [ { "reviews_data": [{review}, ...] } ] }
            if (!json.RootElement.TryGetProperty("data", out var dataArr))
                return results;

            foreach (var dataItem in dataArr.EnumerateArray())
            {
                if (!dataItem.TryGetProperty("reviews_data", out var reviewsData))
                    continue;

                foreach (var review in reviewsData.EnumerateArray())
                {
                    var reviewId = review.TryGetProperty("review_id", out var rid) ? rid.GetString() ?? "" : "";
                    var author = review.TryGetProperty("author_title", out var a) ? a.GetString() ?? "Anónimo" : "Anónimo";
                    var rating = review.TryGetProperty("review_rating", out var r) ? r.GetInt32() : 0;
                    var text = review.TryGetProperty("review_text", out var t) ? t.GetString() ?? "" : "";
                    var dateStr = review.TryGetProperty("review_datetime_utc", out var d) ? d.GetString() ?? "" : "";
                    var ownerAnswer = review.TryGetProperty("owner_answer", out var oa) ? oa.GetString() : null;

                    DateTimeOffset publishedAt = DateTimeOffset.UtcNow;
                    if (!string.IsNullOrEmpty(dateStr))
                    {
                        // Use InvariantCulture to avoid dd/MM vs MM/dd swap on Spanish Windows
                        string[] formats = [
                            "yyyy-MM-dd HH:mm:ss",
                            "MM/dd/yyyy HH:mm:ss",
                            "M/d/yyyy H:mm:ss",
                            "yyyy-MM-ddTHH:mm:ss"
                        ];
                        if (DateTimeOffset.TryParseExact(dateStr, formats,
                            System.Globalization.CultureInfo.InvariantCulture,
                            System.Globalization.DateTimeStyles.AssumeUniversal,
                            out var parsedExact))
                            publishedAt = parsedExact.ToUniversalTime();
                        else if (DateTimeOffset.TryParse(dateStr,
                            System.Globalization.CultureInfo.InvariantCulture,
                            System.Globalization.DateTimeStyles.AssumeUniversal,
                            out var parsedFallback))
                            publishedAt = parsedFallback.ToUniversalTime();
                    }

                    if (!string.IsNullOrEmpty(reviewId))
                        results.Add(new OutscraperReview(reviewId, author, rating, text, publishedAt, ownerAnswer));
                }
            }

            _logger.LogInformation("[OutscraperService] Got {Count} reviews for placeId={PlaceId}", results.Count, placeId);
            return results;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[OutscraperService] Exception fetching reviews");
            return [];
        }
    }
}
