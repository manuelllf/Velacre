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
/// <summary>
/// Obtiene todas las reseñas publicadas en los últimos N días.
/// Usa el parámetro cutoff de Outscraper v3 para filtrar server-side.
/// Mapea todos los campos relevantes (owner_answer, lang, fecha).
/// </summary>
public async Task<List<OutscraperReview>> GetRecentReviewsAsync(string placeId, int dias = 30, int maxReviews = 200)
{
    if (string.IsNullOrEmpty(_apiKey))
    {
        _logger.LogWarning("[OutscraperService] API key no configurada, abortando");
        return [];
    }

    var sinceDate = DateTimeOffset.UtcNow.AddDays(-dias);
    var cutoff = sinceDate.ToUnixTimeSeconds();

    _logger.LogInformation("[OutscraperService] Recent reviews — placeId={PlaceId}, dias={Dias}, cutoff={Cutoff}",
        placeId, dias, sinceDate.ToString("yyyy-MM-dd"));

    var url = $"{BaseUrl}?query={Uri.EscapeDataString(placeId)}&reviewsLimit={maxReviews}&sort=newest&cutoff={cutoff}&async=false";

    var req = new HttpRequestMessage(HttpMethod.Get, url);
    req.Headers.Add("X-API-KEY", _apiKey);

    try
    {
        var response = await _http.SendAsync(req);
        var body = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("[OutscraperService] Recent HTTP {Status}: {Body}", response.StatusCode, body);
            return [];
        }

        var json = JsonDocument.Parse(body);
        var results = new List<OutscraperReview>();

        if (!json.RootElement.TryGetProperty("data", out var dataArr)) return results;

        foreach (var dataItem in dataArr.EnumerateArray())
        {
            if (!dataItem.TryGetProperty("reviews_data", out var reviewsData)) continue;

            foreach (var review in reviewsData.EnumerateArray())
            {
                var mapped = MapReview(review);
                if (mapped != null) results.Add(mapped);
            }
        }

        // Defensa extra: filtrar client-side por si cutoff falla o vienen reseñas sin fecha
        var filtered = results.Where(r => r.PublishedAt >= sinceDate).ToList();

        var respondidas = filtered.Count(r => !string.IsNullOrEmpty(r.OwnerAnswer));
        _logger.LogInformation("[OutscraperService] Recent: {Total} reseñas últimos {Dias}d, {Resp} respondidas",
            filtered.Count, dias, respondidas);

        return filtered;
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "[OutscraperService] Error en GetRecentReviewsAsync");
        return [];
    }
}

/// <summary>
/// Mapeo centralizado de una reseña de Outscraper.
/// Usado por todos los métodos que leen reviews_data.
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

        // Construir URL
        var url = $"{BaseUrl}?query={Uri.EscapeDataString(placeId)}&reviewsLimit={limit}&sort=newest&async=false";

        if (!isInitial && sinceDate.HasValue)
        {
            var cutoff = sinceDate.Value.ToUnixTimeSeconds();
            url += $"&cutoff={cutoff}";
            _logger.LogDebug("[OutscraperService] cutoff={Cutoff} ({Date})", cutoff, sinceDate.Value.ToString("yyyy-MM-dd"));
        }

        var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Add("X-API-KEY", _apiKey);

        try
        {
            var response = await _http.SendAsync(request);
            var body = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("[OutscraperService] Error HTTP {Status}: {Body}", response.StatusCode, body);
                return [];
            }

            _logger.LogDebug("[OutscraperService] Respuesta recibida ({Bytes} bytes)", body.Length);

            var json = JsonDocument.Parse(body);
            var results = new List<OutscraperReview>();

            // Estructura: { "data": [ { "reviews_data": [{...}, ...] } ] }
            if (!json.RootElement.TryGetProperty("data", out var dataArr))
            {
                _logger.LogWarning("[OutscraperService] Respuesta sin campo 'data'");
                return results;
            }

            foreach (var dataItem in dataArr.EnumerateArray())
            {
                if (!dataItem.TryGetProperty("reviews_data", out var reviewsData))
                    continue;

                foreach (var review in reviewsData.EnumerateArray())
                {
                    var reviewId   = review.TryGetProperty("review_id", out var rid) ? rid.GetString() ?? "" : "";
                    var author     = review.TryGetProperty("author_title", out var a) ? a.GetString() ?? "Anónimo" : "Anónimo";
                    var ratingProp = review.TryGetProperty("review_rating", out var r) ? r : default;
                    var rating     = ratingProp.ValueKind == JsonValueKind.Number ? ratingProp.GetInt32() : 0;
                    var text       = review.TryGetProperty("review_text", out var t) ? t.GetString() ?? "" : "";
                    var dateStr    = review.TryGetProperty("review_datetime_utc", out var d) ? d.GetString() ?? "" : "";
                    var ownerAns   = review.TryGetProperty("owner_answer", out var oa) && oa.ValueKind == JsonValueKind.String
                                     ? oa.GetString() : null;
                    var lang       = review.TryGetProperty("review_lang", out var l) && l.ValueKind == JsonValueKind.String
                                     ? l.GetString() : null;

                    if (string.IsNullOrEmpty(reviewId)) continue;

                    var publishedAt = ParseDate(dateStr);
                    results.Add(new OutscraperReview(reviewId, author, rating, text, publishedAt, ownerAns, lang));
                }
            }

            _logger.LogInformation("[OutscraperService] {Count} reseñas obtenidas (modo {Mode})", results.Count, mode);
            return results;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[OutscraperService] Excepción al obtener reseñas");
            return [];
        }
    }

    public async Task<List<OutscraperReview>> GetCompetitorReviewsAsync(string placeId, int limit = 20)
    {
        if (string.IsNullOrEmpty(_apiKey)) return [];
        _logger.LogInformation("[OutscraperService] Competidor snapshot — placeId={PlaceId}, limit={Limit}", placeId, limit);

        var url = $"{BaseUrl}?query={Uri.EscapeDataString(placeId)}&reviewsLimit={limit}&sort=newest&async=false";
        var req = new HttpRequestMessage(HttpMethod.Get, url);
        req.Headers.Add("X-API-KEY", _apiKey);

        try
        {
            var response = await _http.SendAsync(req);
            var body = await response.Content.ReadAsStringAsync();
            if (!response.IsSuccessStatusCode) { _logger.LogError("[OutscraperService] Competidor HTTP {S}", response.StatusCode); return []; }

            var json = JsonDocument.Parse(body);
            var results = new List<OutscraperReview>();
            if (!json.RootElement.TryGetProperty("data", out var dataArr)) return results;

            foreach (var dataItem in dataArr.EnumerateArray())
            {
                if (!dataItem.TryGetProperty("reviews_data", out var reviewsData)) continue;
                foreach (var review in reviewsData.EnumerateArray())
                {
                    var reviewId   = review.TryGetProperty("review_id",     out var rid) ? rid.GetString() ?? "" : "";
                    var author     = review.TryGetProperty("author_title",  out var a)   ? a.GetString()   ?? "Anónimo" : "Anónimo";
                    var ratingProp = review.TryGetProperty("review_rating", out var r)   ? r : default;
                    var rating     = ratingProp.ValueKind == JsonValueKind.Number ? ratingProp.GetInt32() : 0;
                    var text       = review.TryGetProperty("review_text",   out var t)   ? t.GetString()   ?? "" : "";
                    var dateStr2   = review.TryGetProperty("review_datetime_utc", out var d) ? d.GetString() ?? "" : "";
                    if (string.IsNullOrEmpty(reviewId)) continue;
                    results.Add(new OutscraperReview(reviewId, author, rating, text, ParseDate(dateStr2)));
                }
            }
            _logger.LogInformation("[OutscraperService] Competidor: {Count} reseñas", results.Count);
            return results;
        }
        catch (Exception ex) { _logger.LogError(ex, "[OutscraperService] Error en GetCompetitorReviewsAsync"); return []; }
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
