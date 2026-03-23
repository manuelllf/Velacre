using System.Text.Json;
using backend.Interfaces;

namespace backend.Services;

public class OutscraperService
{
    private readonly HttpClient _http;
    private readonly ILogger<OutscraperService> _logger;
    private readonly string _apiKey;

    public OutscraperService(HttpClient http, ILogger<OutscraperService> logger)
    {
        _http = http;
        _logger = logger;
        _apiKey = Environment.GetEnvironmentVariable("OUTSCRAPER_API_KEY") ?? "";
    }

    public async Task<List<GoogleReviewData>> GetReviewsAsync(string placeId, int limit = 20)
    {
        if (string.IsNullOrEmpty(_apiKey))
        {
            _logger.LogWarning("[OutscraperService] OUTSCRAPER_API_KEY not set");
            return new List<GoogleReviewData>();
        }

        var url = $"https://api.outscraper.com/maps/reviews-v3?query={Uri.EscapeDataString(placeId)}&reviewsLimit={limit}&language=es&sort=newest";
        var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Add("X-API-KEY", _apiKey);

        try
        {
            var response = await _http.SendAsync(request);
            var body = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("[OutscraperService] Error {Status}: {Body}", response.StatusCode, body);
                return new List<GoogleReviewData>();
            }

            var json = JsonDocument.Parse(body);
            var results = new List<GoogleReviewData>();

            // Response structure: { "data": [[{review}, {review}]] }
            if (json.RootElement.TryGetProperty("data", out var dataArr) && dataArr.GetArrayLength() > 0)
            {
                var firstGroup = dataArr[0];
                foreach (var review in firstGroup.EnumerateArray())
                {
                    var reviewId = review.TryGetProperty("review_id", out var rid) ? rid.GetString() ?? "" : "";
                    var author = review.TryGetProperty("author_title", out var a) ? a.GetString() ?? "Anónimo" : "Anónimo";
                    var rating = review.TryGetProperty("review_rating", out var r) ? r.GetInt32() : 0;
                    var text = review.TryGetProperty("review_text", out var t) ? t.GetString() ?? "" : "";
                    var dateStr = review.TryGetProperty("review_datetime_utc", out var d) ? d.GetString() ?? "" : "";

                    DateTimeOffset publishedAt = DateTimeOffset.UtcNow;
                    if (!string.IsNullOrEmpty(dateStr) && DateTime.TryParse(dateStr, out var parsedDate))
                        publishedAt = new DateTimeOffset(parsedDate, TimeSpan.Zero);

                    if (!string.IsNullOrEmpty(reviewId))
                        results.Add(new GoogleReviewData(reviewId, author, rating, text, publishedAt));
                }
            }

            _logger.LogInformation("[OutscraperService] Got {Count} reviews for placeId={PlaceId}", results.Count, placeId);
            return results;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[OutscraperService] Exception fetching reviews");
            return new List<GoogleReviewData>();
        }
    }
}
