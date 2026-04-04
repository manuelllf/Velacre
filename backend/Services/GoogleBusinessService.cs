using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using backend.Interfaces;
using backend.Models;
using backend.Models.Entities;

namespace backend.Services;

public class GoogleBusinessService : IGoogleBusinessService
{
    private readonly HttpClient _http;
    private readonly Supabase.Client _supabase;
    private readonly ILogger<GoogleBusinessService> _logger;

    private readonly string _clientId;
    private readonly string _clientSecret;
    private readonly string _redirectUri;
    private readonly string _frontendUrl;

    private const string TokenEndpoint    = "https://oauth2.googleapis.com/token";
    private const string RevokeEndpoint   = "https://oauth2.googleapis.com/revoke";
    private const string AccountsEndpoint = "https://mybusinessaccountmanagement.googleapis.com/v1/accounts";
    private const string ReviewsBaseUrl   = "https://mybusiness.googleapis.com/v4";
    private const string LocationsBaseUrl = "https://mybusinessbusinessinformation.googleapis.com/v1";

    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };

    public GoogleBusinessService(
        HttpClient http,
        Supabase.Client supabase,
        ILogger<GoogleBusinessService> logger)
    {
        _http      = http;
        _supabase  = supabase;
        _logger    = logger;
        _clientId     = Environment.GetEnvironmentVariable("GOOGLE_OAUTH_CLIENT_ID")     ?? throw new InvalidOperationException("GOOGLE_OAUTH_CLIENT_ID no configurado");
        _clientSecret = Environment.GetEnvironmentVariable("GOOGLE_OAUTH_CLIENT_SECRET") ?? throw new InvalidOperationException("GOOGLE_OAUTH_CLIENT_SECRET no configurado");
        _redirectUri  = Environment.GetEnvironmentVariable("GOOGLE_OAUTH_REDIRECT_URI")  ?? throw new InvalidOperationException("GOOGLE_OAUTH_REDIRECT_URI no configurado");
        _frontendUrl  = (Environment.GetEnvironmentVariable("FRONTEND_URL") ?? "http://localhost:3000").TrimEnd('/');
    }

    // ─── OAuth URL ────────────────────────────────────────────────────────────

    public string GenerateAuthUrl(Guid negocioId, Guid userId, string returnTo)
    {
        var state = BuildSignedState(negocioId, userId, returnTo);
        var scope = Uri.EscapeDataString("https://www.googleapis.com/auth/business.manage");
        var redirect = Uri.EscapeDataString(_redirectUri);

        return $"https://accounts.google.com/o/oauth2/v2/auth" +
               $"?client_id={_clientId}" +
               $"&redirect_uri={redirect}" +
               $"&response_type=code" +
               $"&scope={scope}" +
               $"&access_type=offline" +
               $"&prompt=consent" +
               $"&state={Uri.EscapeDataString(state)}";
    }

    // ─── Callback ─────────────────────────────────────────────────────────────

    public async Task<GbpCallbackResult> HandleCallbackAsync(string code, string state)
    {
        // 1. Validar state firmado
        if (!TryParseState(state, out var negocioId, out var userId, out var returnTo))
        {
            _logger.LogWarning("[GBP] State inválido o expirado");
            return Fail("state_invalid", returnTo ?? "onboarding", _frontendUrl);
        }

        // 2. Intercambiar code por tokens
        var tokens = await ExchangeCodeAsync(code);
        if (tokens == null)
        {
            _logger.LogWarning("[GBP] Fallo al intercambiar code por tokens para negocioId={Id}", negocioId);
            return Fail("token_exchange_failed", returnTo, _frontendUrl);
        }

        // 3. Guardar conexión preliminar (is_active=false) — upsert por negocio_id
        var expiry = DateTimeOffset.UtcNow.AddSeconds(tokens.ExpiresIn - 60);
        await UpsertConnectionAsync(negocioId, "", "", null, tokens.AccessToken, tokens.RefreshToken, expiry, isActive: false);

        // 4. Listar locales GBP del usuario
        var locations = await FetchAllLocationsAsync(tokens.AccessToken);
        if (locations.Count == 0)
        {
            _logger.LogWarning("[GBP] No se encontraron locales GBP para negocioId={Id}", negocioId);
            return Fail("no_locations", returnTo, _frontendUrl);
        }

        // 5. Auto-selección si solo hay 1 local
        if (locations.Count == 1)
        {
            var loc = locations[0];
            await FinalizeConnectionAsync(negocioId, userId, loc.LocationName, loc.DisplayName);
            _logger.LogInformation("[GBP] Auto-seleccionado local '{Name}' para negocioId={Id}", loc.DisplayName, negocioId);
            return new GbpCallbackResult(
                Success: true, Error: null, AutoSelected: true,
                Locations: locations,
                RedirectUrl: $"{_frontendUrl}/{returnTo}?gbp=connected"
            );
        }

        // 6. Múltiples locales: el frontend mostrará el selector
        _logger.LogInformation("[GBP] {Count} locales disponibles para negocioId={Id}, requiere selección manual", locations.Count, negocioId);
        return new GbpCallbackResult(
            Success: true, Error: null, AutoSelected: false,
            Locations: locations,
            RedirectUrl: $"{_frontendUrl}/{returnTo}?gbp=select"
        );
    }

    // ─── Listar locales ───────────────────────────────────────────────────────

    public async Task<List<GbpLocation>> GetLocationsAsync(Guid negocioId)
    {
        var conn = await GetConnectionRawAsync(negocioId);
        if (conn == null) return [];

        var accessToken = await EnsureValidTokenAsync(conn);
        if (accessToken == null) return [];

        return await FetchAllLocationsAsync(accessToken);
    }

    // ─── Finalizar conexión ───────────────────────────────────────────────────

    public async Task FinalizeConnectionAsync(Guid negocioId, Guid userId, string locationName, string displayName)
    {
        // Extraer accountId del locationName ("accounts/123/locations/456" → "accounts/123")
        var accountId = locationName.Contains("/locations/")
            ? locationName[..locationName.IndexOf("/locations/")]
            : "";

        // Activar la conexión con el local elegido
        var conn = await GetConnectionRawAsync(negocioId);
        if (conn == null) return;

        conn.GoogleAccountId = accountId;
        conn.LocationName    = locationName;
        conn.DisplayName     = displayName;
        conn.IsActive        = true;

        await _supabase.From<GoogleConnectionEntity>()
            .Where(c => c.NegocioId == negocioId)
            .Update(conn);

        _logger.LogInformation("[GBP] Conexión finalizada: local='{Name}' negocioId={Id}", displayName, negocioId);

        // Borrar reseñas antiguas (Outscraper o GBP previo)
        await DeleteAllReviewsForNegocioAsync(negocioId);

        // Sync inicial desde GBP
        await SyncReviewsAsync(negocioId, userId);
    }

    // ─── Desconectar ──────────────────────────────────────────────────────────

    public async Task DisconnectAsync(Guid negocioId, Guid userId)
    {
        var conn = await GetConnectionAsync(negocioId);
        if (conn == null) return;

        // Revocar el access_token en Google
        try
        {
            await _http.PostAsync($"{RevokeEndpoint}?token={Uri.EscapeDataString(conn.AccessToken)}", null);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[GBP] Error al revocar token para negocioId={Id} (continúa limpieza)", negocioId);
        }

        // Borrar reseñas
        await DeleteAllReviewsForNegocioAsync(negocioId);

        // Borrar la conexión
        await _supabase.From<GoogleConnectionEntity>()
            .Where(c => c.NegocioId == negocioId)
            .Delete();

        _logger.LogInformation("[GBP] Desconectado y reseñas eliminadas para negocioId={Id}", negocioId);
    }

    // ─── Obtener conexión ─────────────────────────────────────────────────────

    public async Task<GoogleConnectionEntity?> GetConnectionAsync(Guid negocioId)
    {
        var result = await _supabase.From<GoogleConnectionEntity>()
            .Where(c => c.NegocioId == negocioId && c.IsActive == true)
            .Limit(1)
            .Get();
        return result.Models.FirstOrDefault();
    }

    private async Task<GoogleConnectionEntity?> GetConnectionRawAsync(Guid negocioId)
    {
        var result = await _supabase.From<GoogleConnectionEntity>()
            .Where(c => c.NegocioId == negocioId)
            .Limit(1)
            .Get();
        return result.Models.FirstOrDefault();
    }

    // ─── Sync reseñas ─────────────────────────────────────────────────────────

    public async Task<(int NewCount, int UpdatedCount)> SyncReviewsAsync(Guid negocioId, Guid userId)
    {
        var conn = await GetConnectionAsync(negocioId);
        if (conn == null)
        {
            _logger.LogWarning("[GBP] SyncReviews: no hay conexión activa para negocioId={Id}", negocioId);
            return (0, 0);
        }

        var accessToken = await EnsureValidTokenAsync(conn);
        if (accessToken == null)
        {
            _logger.LogError("[GBP] SyncReviews: no se pudo refrescar token para negocioId={Id}", negocioId);
            return (0, 0);
        }

        // Reseñas existentes en BD para detectar duplicados y actualizaciones
        var existingResult = await _supabase.From<ReviewEntity>()
            .Where(r => r.IdNegocio == negocioId)
            .Get();
        var existingByGoogleId = existingResult.Models
            .Where(r => !string.IsNullOrEmpty(r.GoogleReviewId))
            .ToDictionary(r => r.GoogleReviewId!, r => r);

        // Determinar modo: inicial (sin reseñas) o incremental
        bool isInitial = existingResult.Models.Count == 0;

        var gbpReviews = await FetchReviewsAsync(accessToken, conn.LocationName);
        _logger.LogInformation("[GBP] Sync {Mode}: {Count} reseñas obtenidas de GBP para negocioId={Id}",
            isInitial ? "INICIAL" : "INCREMENTAL", gbpReviews.Count, negocioId);

        int newCount     = 0;
        int updatedCount = 0;

        foreach (var gr in gbpReviews)
        {
            if (existingByGoogleId.TryGetValue(gr.ReviewId, out var existing))
            {
                // Actualizar si Google tiene ahora una respuesta del propietario que no teníamos
                if (!string.IsNullOrWhiteSpace(gr.OwnerReply) && existing.TonoGenerado != "google")
                {
                    existing.RespuestaProfesional = gr.OwnerReply;
                    existing.RespuestaCercano     = gr.OwnerReply;
                    existing.RespuestaDirecto     = gr.OwnerReply;
                    existing.TonoGenerado         = "google";
                    existing.Estado               = "respondida";
                    existing.ActualizadoPor       = userId;
                    existing.ActualizadoFecha     = DateTimeOffset.UtcNow;
                    await _supabase.From<ReviewEntity>().Where(r => r.Id == existing.Id).Update(existing);
                    updatedCount++;
                }
                continue;
            }

            // Nueva reseña
            var yaRespondida = !string.IsNullOrWhiteSpace(gr.OwnerReply);
            var entity = new ReviewEntity
            {
                Codigo               = "BFK" + Guid.NewGuid().ToString("N")[..7].ToUpper(),
                IdNegocio            = negocioId,
                GoogleReviewId       = gr.ReviewId,
                AuthorName           = gr.AuthorName,
                StarRating           = gr.StarRating,
                ReviewDate           = gr.CreateTime,
                ClienteReview        = gr.Comment ?? "",
                ReviewLanguage       = gr.Language,
                RespuestaProfesional = yaRespondida ? gr.OwnerReply : null,
                RespuestaCercano     = yaRespondida ? gr.OwnerReply : null,
                RespuestaDirecto     = yaRespondida ? gr.OwnerReply : null,
                TonoGenerado         = yaRespondida ? "google" : null,
                Estado               = yaRespondida ? "respondida" : "pendiente",
                Plataforma           = "Google",
                CreadoPor            = userId,
                CreadoFecha          = DateTimeOffset.UtcNow
            };

            await _supabase.From<ReviewEntity>().Insert(entity);
            newCount++;
        }

        _logger.LogInformation("[GBP] Sync completado: {New} nuevas, {Updated} actualizadas", newCount, updatedCount);
        return (newCount, updatedCount);
    }

    // ─── Publicar respuesta en Google ─────────────────────────────────────────

    public async Task<(bool Ok, string? Error)> PublishReplyAsync(Guid reviewId, Guid userId, string replyText)
    {
        // Obtener la reseña y el negocio
        var reviewResult = await _supabase.From<ReviewEntity>()
            .Where(r => r.Id == reviewId)
            .Limit(1)
            .Get();
        var review = reviewResult.Models.FirstOrDefault();
        if (review == null) return (false, "review_not_found");
        if (string.IsNullOrEmpty(review.GoogleReviewId)) return (false, "no_google_review_id");

        var conn = await GetConnectionAsync(review.IdNegocio);
        if (conn == null) return (false, "gbp_not_connected");

        var accessToken = await EnsureValidTokenAsync(conn);
        if (accessToken == null) return (false, "token_refresh_failed");

        // Construir URL: accounts/X/locations/Y/reviews/Z/reply
        var reviewName = $"{conn.LocationName}/reviews/{review.GoogleReviewId}";
        var url        = $"{ReviewsBaseUrl}/{reviewName}/reply";

        var payload = JsonSerializer.Serialize(new { comment = replyText });
        var request = new HttpRequestMessage(HttpMethod.Put, url)
        {
            Content = new StringContent(payload, Encoding.UTF8, "application/json")
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        try
        {
            var response = await _http.SendAsync(request);
            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync();
                _logger.LogError("[GBP] Error al publicar reply HTTP={Status}: {Body}", (int)response.StatusCode, body);
                return (false, $"gbp_api_error_{(int)response.StatusCode}");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[GBP] Excepción publicando reply para reviewId={Id}", reviewId);
            return (false, "network_error");
        }

        // Actualizar la reseña en BD
        review.RespuestaPublicada = replyText;
        review.PublicadaEnGoogle  = true;
        review.PublicadaFecha     = DateTimeOffset.UtcNow;
        review.Estado             = "respondida";
        if (review.RespondidaFecha == null)
            review.RespondidaFecha = DateTimeOffset.UtcNow;
        review.ActualizadoPor   = userId;
        review.ActualizadoFecha = DateTimeOffset.UtcNow;

        await _supabase.From<ReviewEntity>().Where(r => r.Id == reviewId).Update(review);
        _logger.LogInformation("[GBP] Reply publicado en Google para reviewId={Id}", reviewId);

        return (true, null);
    }

    // ─── Helpers internos ─────────────────────────────────────────────────────

    private async Task<TokenResponse?> ExchangeCodeAsync(string code)
    {
        var form = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["code"]          = code,
            ["client_id"]     = _clientId,
            ["client_secret"] = _clientSecret,
            ["redirect_uri"]  = _redirectUri,
            ["grant_type"]    = "authorization_code"
        });

        try
        {
            var res = await _http.PostAsync(TokenEndpoint, form);
            if (!res.IsSuccessStatusCode)
            {
                _logger.LogError("[GBP] ExchangeCode HTTP={Status}: {Body}", (int)res.StatusCode, await res.Content.ReadAsStringAsync());
                return null;
            }
            var json = await res.Content.ReadAsStringAsync();
            return JsonSerializer.Deserialize<TokenResponse>(json, JsonOpts);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[GBP] Excepción en ExchangeCode");
            return null;
        }
    }

    private async Task<string?> EnsureValidTokenAsync(GoogleConnectionEntity conn)
    {
        if (DateTimeOffset.UtcNow < conn.TokenExpiry)
            return conn.AccessToken;

        _logger.LogInformation("[GBP] Access token expirado, refrescando para negocioId={Id}", conn.NegocioId);

        var form = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["client_id"]     = _clientId,
            ["client_secret"] = _clientSecret,
            ["refresh_token"] = conn.RefreshToken,
            ["grant_type"]    = "refresh_token"
        });

        try
        {
            var res = await _http.PostAsync(TokenEndpoint, form);
            if (!res.IsSuccessStatusCode)
            {
                _logger.LogError("[GBP] Refresh token HTTP={Status}", (int)res.StatusCode);
                return null;
            }

            var json    = await res.Content.ReadAsStringAsync();
            var tokens  = JsonSerializer.Deserialize<TokenResponse>(json, JsonOpts);
            if (tokens == null) return null;

            var newExpiry = DateTimeOffset.UtcNow.AddSeconds(tokens.ExpiresIn - 60);
            conn.AccessToken  = tokens.AccessToken;
            conn.TokenExpiry  = newExpiry;
            await _supabase.From<GoogleConnectionEntity>()
                .Where(c => c.NegocioId == conn.NegocioId)
                .Update(conn);

            return tokens.AccessToken;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[GBP] Excepción refrescando token");
            return null;
        }
    }

    private async Task<List<GbpLocation>> FetchAllLocationsAsync(string accessToken)
    {
        var locations = new List<GbpLocation>();

        // 1. Obtener cuentas GBP del usuario
        var accountsReq = new HttpRequestMessage(HttpMethod.Get, AccountsEndpoint);
        accountsReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        var accountsRes = await _http.SendAsync(accountsReq);
        var accountsBody = await accountsRes.Content.ReadAsStringAsync();
        if (!accountsRes.IsSuccessStatusCode)
        {
            _logger.LogError("[GBP] Error listando cuentas HTTP={Status} Body={Body}", (int)accountsRes.StatusCode, accountsBody);
            return locations;
        }

        _logger.LogInformation("[GBP] Accounts response: {Body}", accountsBody);

        using var accountsDoc = JsonDocument.Parse(accountsBody);
        if (!accountsDoc.RootElement.TryGetProperty("accounts", out var accountsArr))
        {
            _logger.LogWarning("[GBP] Respuesta de cuentas sin campo 'accounts': {Body}", accountsBody);
            return locations;
        }

        // 2. Por cada cuenta, listar sus locales (Business Information API + fallback legacy v4)
        foreach (var account in accountsArr.EnumerateArray())
        {
            var accountName = account.GetProperty("name").GetString();
            if (string.IsNullOrEmpty(accountName)) continue;

            var accountType = account.TryGetProperty("type", out var tp) ? tp.GetString() : "UNKNOWN";
            _logger.LogInformation("[GBP] Procesando cuenta {Account} tipo={Type}", accountName, accountType);

            // Intentar primero con la Business Information API (v1)
            var locUrlV1 = $"{LocationsBaseUrl}/{accountName}/locations?readMask=name,title&pageSize=100";
            var locReqV1 = new HttpRequestMessage(HttpMethod.Get, locUrlV1);
            locReqV1.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

            var locResV1  = await _http.SendAsync(locReqV1);
            var locBodyV1 = await locResV1.Content.ReadAsStringAsync();
            _logger.LogInformation("[GBP] Locations v1 HTTP={Status} Body={Body}", (int)locResV1.StatusCode, locBodyV1);

            if (locResV1.IsSuccessStatusCode)
            {
                using var locDoc = JsonDocument.Parse(locBodyV1);
                if (locDoc.RootElement.TryGetProperty("locations", out var locsArr))
                {
                    foreach (var loc in locsArr.EnumerateArray())
                    {
                        var locName  = loc.TryGetProperty("name",  out var ln) ? ln.GetString() ?? "" : "";
                        var locTitle = loc.TryGetProperty("title", out var lt) ? lt.GetString() ?? locName : locName;
                        if (!string.IsNullOrEmpty(locName))
                            locations.Add(new GbpLocation(locName, locTitle, accountName));
                    }
                    continue; // OK con v1, pasar a la siguiente cuenta
                }
            }

            // Fallback: legacy My Business API v4
            _logger.LogWarning("[GBP] Fallback a legacy v4 para cuenta {Account}", accountName);
            var locUrlV4 = $"https://mybusiness.googleapis.com/v4/{accountName}/locations?pageSize=100";
            var locReqV4 = new HttpRequestMessage(HttpMethod.Get, locUrlV4);
            locReqV4.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

            var locResV4  = await _http.SendAsync(locReqV4);
            var locBodyV4 = await locResV4.Content.ReadAsStringAsync();
            _logger.LogInformation("[GBP] Locations v4 HTTP={Status} Body={Body}", (int)locResV4.StatusCode, locBodyV4);

            if (!locResV4.IsSuccessStatusCode) continue;

            using var locDocV4 = JsonDocument.Parse(locBodyV4);
            if (!locDocV4.RootElement.TryGetProperty("locations", out var locsArrV4)) continue;

            foreach (var loc in locsArrV4.EnumerateArray())
            {
                // v4 usa "name" y "locationName" (objeto anidado)
                var locName = loc.TryGetProperty("name", out var ln) ? ln.GetString() ?? "" : "";
                string locTitle;
                if (loc.TryGetProperty("locationName", out var ltn))
                    locTitle = ltn.GetString() ?? locName;
                else if (loc.TryGetProperty("title", out var lt))
                    locTitle = lt.GetString() ?? locName;
                else
                    locTitle = locName;

                if (!string.IsNullOrEmpty(locName))
                    locations.Add(new GbpLocation(locName, locTitle, accountName));
            }
        }

        _logger.LogInformation("[GBP] Total locales encontrados: {Count}", locations.Count);
        return locations;
    }

    private async Task<List<GbpReview>> FetchReviewsAsync(string accessToken, string locationName)
    {
        var all        = new List<GbpReview>();
        string? pageToken = null;

        do
        {
            var url = $"{ReviewsBaseUrl}/{locationName}/reviews?pageSize=50&orderBy=updateTime%20desc";
            if (pageToken != null) url += $"&pageToken={Uri.EscapeDataString(pageToken)}";

            var req = new HttpRequestMessage(HttpMethod.Get, url);
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

            var res = await _http.SendAsync(req);
            if (!res.IsSuccessStatusCode)
            {
                _logger.LogError("[GBP] Error listando reseñas HTTP={Status}: {Body}", (int)res.StatusCode, await res.Content.ReadAsStringAsync());
                break;
            }

            using var doc  = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
            var root        = doc.RootElement;

            if (root.TryGetProperty("reviews", out var reviewsArr))
            {
                foreach (var r in reviewsArr.EnumerateArray())
                {
                    // name: "accounts/X/locations/Y/reviews/REVIEW_ID"
                    var fullName  = r.TryGetProperty("name",     out var n)  ? n.GetString()  ?? "" : "";
                    var reviewId  = fullName.Contains("/reviews/") ? fullName[(fullName.LastIndexOf("/reviews/") + 9)..] : fullName;
                    var author    = r.TryGetProperty("reviewer",  out var rv) ? (rv.TryGetProperty("displayName", out var dn) ? dn.GetString() ?? "" : "") : "";
                    var starStr   = r.TryGetProperty("starRating", out var sr) ? sr.GetString() ?? "" : "";
                    var comment   = r.TryGetProperty("comment",   out var c)  ? c.GetString()  : null;
                    var createStr = r.TryGetProperty("createTime", out var ct) ? ct.GetString() : null;
                    var ownerReply = (r.TryGetProperty("reviewReply", out var rr) &&
                                      rr.TryGetProperty("comment", out var rc))
                                     ? rc.GetString() : null;

                    DateTimeOffset? createTime = null;
                    if (createStr != null && DateTimeOffset.TryParse(createStr, out var parsed))
                        createTime = parsed;

                    all.Add(new GbpReview
                    {
                        ReviewId   = reviewId,
                        AuthorName = author,
                        StarRating = ParseStarRating(starStr),
                        Comment    = comment,
                        CreateTime = createTime,
                        OwnerReply = ownerReply,
                        Language   = DetectLanguage(comment)
                    });
                }
            }

            pageToken = root.TryGetProperty("nextPageToken", out var npt) ? npt.GetString() : null;

        } while (pageToken != null);

        return all;
    }

    private async Task UpsertConnectionAsync(Guid negocioId, string accountId, string locationName,
        string? displayName, string accessToken, string refreshToken, DateTimeOffset expiry, bool isActive)
    {
        var existing = await GetConnectionRawAsync(negocioId);

        if (existing != null)
        {
            existing.GoogleAccountId = accountId;
            existing.LocationName    = locationName;
            existing.DisplayName     = displayName;
            existing.AccessToken     = accessToken;
            existing.RefreshToken    = refreshToken;
            existing.TokenExpiry     = expiry;
            existing.IsActive        = isActive;
            existing.ConnectedAt     = DateTimeOffset.UtcNow;
            await _supabase.From<GoogleConnectionEntity>()
                .Where(c => c.NegocioId == negocioId)
                .Update(existing);
        }
        else
        {
            var entity = new GoogleConnectionEntity
            {
                NegocioId       = negocioId,
                GoogleAccountId = accountId,
                LocationName    = locationName,
                DisplayName     = displayName,
                AccessToken     = accessToken,
                RefreshToken    = refreshToken,
                TokenExpiry     = expiry,
                ConnectedAt     = DateTimeOffset.UtcNow,
                IsActive        = isActive
            };
            await _supabase.From<GoogleConnectionEntity>().Insert(entity);
        }
    }

    private async Task DeleteAllReviewsForNegocioAsync(Guid negocioId)
    {
        var existing = await _supabase.From<ReviewEntity>()
            .Where(r => r.IdNegocio == negocioId)
            .Get();

        foreach (var r in existing.Models)
            await _supabase.From<ReviewEntity>().Where(x => x.Id == r.Id).Delete();

        _logger.LogInformation("[GBP] Eliminadas {Count} reseñas previas de negocioId={Id}", existing.Models.Count, negocioId);
    }

    // ─── State HMAC ───────────────────────────────────────────────────────────

    private string BuildSignedState(Guid negocioId, Guid userId, string returnTo)
    {
        var payload = Convert.ToBase64String(JsonSerializer.SerializeToUtf8Bytes(new
        {
            negocioId = negocioId.ToString(),
            userId    = userId.ToString(),
            returnTo,
            ts = DateTimeOffset.UtcNow.ToUnixTimeSeconds()
        }));

        var sig = ComputeHmac(payload);
        return $"{payload}.{sig}";
    }

    private bool TryParseState(string state, out Guid negocioId, out Guid userId, out string returnTo)
    {
        negocioId = Guid.Empty;
        userId    = Guid.Empty;
        returnTo  = "onboarding";

        try
        {
            var dot = state.LastIndexOf('.');
            if (dot < 0) return false;

            var payload      = state[..dot];
            var sig          = state[(dot + 1)..];
            var expectedSig  = ComputeHmac(payload);

            // Comparación en tiempo constante para evitar timing attacks
            if (!CryptographicOperations.FixedTimeEquals(
                    Convert.FromHexString(sig.PadRight(64, '0')[..64]),
                    Convert.FromHexString(expectedSig)))
                return false;

            var json = Encoding.UTF8.GetString(Convert.FromBase64String(payload));
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            var ts = root.GetProperty("ts").GetInt64();
            if (DateTimeOffset.UtcNow.ToUnixTimeSeconds() - ts > 600) // 10 min
                return false;

            negocioId = Guid.Parse(root.GetProperty("negocioId").GetString()!);
            userId    = Guid.Parse(root.GetProperty("userId").GetString()!);
            returnTo  = root.TryGetProperty("returnTo", out var rt) ? rt.GetString() ?? "onboarding" : "onboarding";
            return true;
        }
        catch
        {
            return false;
        }
    }

    private string ComputeHmac(string payload)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(_clientSecret));
        return Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes(payload)));
    }

    // ─── Helpers de parseo ────────────────────────────────────────────────────

    private static int ParseStarRating(string s) => s switch
    {
        "ONE"   => 1,
        "TWO"   => 2,
        "THREE" => 3,
        "FOUR"  => 4,
        "FIVE"  => 5,
        _       => 0
    };

    /// <summary>Detección básica de idioma por script (suficiente para el MVP)</summary>
    private static string DetectLanguage(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return "es";
        // Si contiene caracteres cirílicos, chinos, etc., marcamos como "other"
        foreach (var c in text)
        {
            if (c > 0x036F) return "other";
        }
        return "es"; // fallback; Claude detectará el idioma real al generar la respuesta
    }

    private static GbpCallbackResult Fail(string error, string returnTo, string frontendUrl) =>
        new(Success: false, Error: error, AutoSelected: false, Locations: [],
            RedirectUrl: $"{frontendUrl}/{returnTo}?gbp=error&msg={error}");

    // ─── DTOs internos ────────────────────────────────────────────────────────

    private class TokenResponse
    {
        [System.Text.Json.Serialization.JsonPropertyName("access_token")]
        public string AccessToken { get; set; } = "";

        [System.Text.Json.Serialization.JsonPropertyName("refresh_token")]
        public string RefreshToken { get; set; } = "";

        [System.Text.Json.Serialization.JsonPropertyName("expires_in")]
        public int ExpiresIn { get; set; } = 3600;
    }

    private class GbpReview
    {
        public string ReviewId   { get; set; } = "";
        public string AuthorName { get; set; } = "";
        public int    StarRating { get; set; }
        public string? Comment   { get; set; }
        public DateTimeOffset? CreateTime { get; set; }
        public string? OwnerReply { get; set; }
        public string Language    { get; set; } = "es";
    }
}
