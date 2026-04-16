using System.Text.Json;
using backend.Interfaces;

namespace backend.Services;

public class OutscraperService : IOutscraperService
{
    private readonly HttpClient _http;
    private readonly ILogger<OutscraperService> _logger;
    private readonly string _apiKey;

    // Endpoint v3 (REST síncrono, soporta cutoff + reviewsLimit sin cap de 20)
    private const string BaseUrl = "https://api.app.outscraper.com/maps/reviews-v3";

    public OutscraperService(HttpClient http, ILogger<OutscraperService> logger)
    {
        _http = http;
        _logger = logger;
        _apiKey = Environment.GetEnvironmentVariable("OUTSCRAPER_API_KEY") ?? "";

        if (!string.IsNullOrWhiteSpace(_apiKey))
            _logger.LogInformation("[OutscraperService] OUTSCRAPER_API_KEY configurada");
        else
            _logger.LogWarning("[OutscraperService] OUTSCRAPER_API_KEY NO configurada");
    }

    public async Task<List<OutscraperReview>> GetReviewsAsync(string placeId, DateTimeOffset? sinceDate = null)
    {
        if (string.IsNullOrEmpty(_apiKey))
        {
            _logger.LogWarning("[OutscraperService] API key no configurada, abortando");
            return [];
        }

        bool isInitial = sinceDate == null;
        int limit = isInitial ? 60 : 500;
        string mode = isInitial ? "inicial" : "incremental";

        _logger.LogInformation("[OutscraperService] Sync {Mode} — placeId={PlaceId}, limit={Limit}, sinceDate={Since}",
            mode, placeId, limit, sinceDate?.ToString("yyyy-MM-dd") ?? "—");

        var url = $"{BaseUrl}?query={Uri.EscapeDataString(placeId)}&reviewsLimit={limit}&sort=newest&async=false";
        if (!isInitial && sinceDate.HasValue)
        {
            var cutoff = sinceDate.Value.ToUnixTimeSeconds();
            url += $"&cutoff={cutoff}";
            _logger.LogDebug("[OutscraperService] cutoff={Cutoff} ({Date})", cutoff, sinceDate.Value.ToString("yyyy-MM-dd"));
        }

        var results = await FetchAndMapAsync(url, $"sync {mode}");
        _logger.LogInformation("[OutscraperService] {Count} reseñas obtenidas (modo {Mode})", results.Count, mode);
        return results;
    }

    public async Task<List<OutscraperReview>> GetCompetitorReviewsAsync(string placeId, int limit = 20)
    {
        if (string.IsNullOrEmpty(_apiKey)) return [];
        _logger.LogInformation("[OutscraperService] Competidor snapshot — placeId={PlaceId}, limit={Limit}", placeId, limit);

        var url = $"{BaseUrl}?query={Uri.EscapeDataString(placeId)}&reviewsLimit={limit}&sort=newest&async=false";
        var results = await FetchAndMapAsync(url, "competidor");
        _logger.LogInformation("[OutscraperService] Competidor: {Count} reseñas", results.Count);
        return results;
    }

    public async Task<List<OutscraperReview>> GetRecentReviewsAsync(string placeId, int dias = 30, int maxReviews = 200)
    {
        if (string.IsNullOrEmpty(_apiKey))
        {
            _logger.LogWarning("[OutscraperService] API key no configurada, abortando GetRecentReviewsAsync");
            return [];
        }

        var sinceDate = DateTimeOffset.UtcNow.AddDays(-dias);
        var cutoff = sinceDate.ToUnixTimeSeconds();

        _logger.LogInformation("[OutscraperService] Recent reviews — placeId={PlaceId}, dias={Dias}, cutoff={Date}",
            placeId, dias, sinceDate.ToString("yyyy-MM-dd"));

        var url = $"{BaseUrl}?query={Uri.EscapeDataString(placeId)}&reviewsLimit={maxReviews}&sort=newest&cutoff={cutoff}&async=false";
        var results = await FetchAndMapAsync(url, "recent");

        // Defensa client-side por si cutoff falla o llega alguna reseña sin fecha
        var filtered = results.Where(r => r.PublishedAt >= sinceDate).ToList();

        var respondidas = filtered.Count(r => !string.IsNullOrEmpty(r.OwnerAnswer));
        _logger.LogInformation("[OutscraperService] Recent: {Total} reseñas últimos {Dias}d, {Resp} respondidas",
            filtered.Count, dias, respondidas);

        return filtered;
    }

    // ─── Helpers privados ────────────────────────────────────────────────────

    private async Task<List<OutscraperReview>> FetchAndMapAsync(string url, string context)
    {
        var req = new HttpRequestMessage(HttpMethod.Get, url);
        req.Headers.Add("X-API-KEY", _apiKey);

        try
        {
            var response = await _http.SendAsync(req);
            var body = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("[OutscraperService] HTTP {Status} ({Ctx}): {Body}", response.StatusCode, context, body);
                return [];
            }

            var json = JsonDocument.Parse(body);
            var results = new List<OutscraperReview>();

            // Estructura: { "data": [ { "reviews_data": [{...}, ...] } ] }
            if (!json.RootElement.TryGetProperty("data", out var dataArr))
            {
                _logger.LogWarning("[OutscraperService] Respuesta sin campo 'data' ({Ctx})", context);
                return results;
            }

            foreach (var dataItem in dataArr.EnumerateArray())
            {
                if (!dataItem.TryGetProperty("reviews_data", out var reviewsData))
                    continue;

                foreach (var review in reviewsData.EnumerateArray())
                {
                    var mapped = MapReview(review);
                    if (mapped != null) results.Add(mapped);
                }
            }

            return results;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[OutscraperService] Excepción ({Ctx})", context);
            return [];
        }
    }

    /// <summary>
    /// Mapeo centralizado de una reseña de Outscraper (reviews-v3).
    /// Incluye todos los campos relevantes: autor, rating, texto, fecha,
    /// respuesta del propietario e idioma detectado.
    /// </summary>
    private static OutscraperReview? MapReview(JsonElement review)
    {
        var reviewId = review.TryGetProperty("review_id", out var rid) ? rid.GetString() ?? "" : "";
        if (string.IsNullOrEmpty(reviewId)) return null;

        var author     = review.TryGetProperty("author_title", out var a) ? a.GetString() ?? "Anónimo" : "Anónimo";
        var ratingProp = review.TryGetProperty("review_rating", out var r) ? r : default;
        var rating     = ratingProp.ValueKind == JsonValueKind.Number ? ratingProp.GetInt32() : 0;
        var text       = review.TryGetProperty("review_text", out var t) ? t.GetString() ?? "" : "";
        var dateStr    = review.TryGetProperty("review_datetime_utc", out var d) ? d.GetString() ?? "" : "";
        var ownerAns   = review.TryGetProperty("owner_answer", out var oa) && oa.ValueKind == JsonValueKind.String
                         ? oa.GetString() : null;
        var lang       = review.TryGetProperty("review_lang", out var l) && l.ValueKind == JsonValueKind.String
                         ? l.GetString() : null;

        return new OutscraperReview(reviewId, author, rating, text, ParseDate(dateStr), ownerAns, lang);
    }

    private static DateTimeOffset ParseDate(string dateStr)
    {
        if (string.IsNullOrEmpty(dateStr)) return DateTimeOffset.UtcNow;

        string[] formats =
        [
            "yyyy-MM-dd HH:mm:ss",
            "MM/dd/yyyy HH:mm:ss",
            "M/d/yyyy H:mm:ss",
            "yyyy-MM-ddTHH:mm:ss"
        ];

        if (DateTimeOffset.TryParseExact(dateStr, formats,
            System.Globalization.CultureInfo.InvariantCulture,
            System.Globalization.DateTimeStyles.AssumeUniversal,
            out var parsed))
            return parsed.ToUniversalTime();

        if (DateTimeOffset.TryParse(dateStr,
            System.Globalization.CultureInfo.InvariantCulture,
            System.Globalization.DateTimeStyles.AssumeUniversal,
            out var fallback))
            return fallback.ToUniversalTime();

        return DateTimeOffset.UtcNow;
    }
}
