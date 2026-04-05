using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using backend.Models.Entities;

namespace backend.Controllers;

[ApiController]
[Route("api/lemonsqueezy")]
public class LemonController : ControllerBase
{
    private readonly Supabase.Client _supabase;
    private readonly ILogger<LemonController> _logger;
    private readonly IHttpClientFactory _httpFactory;

    public LemonController(
        Supabase.Client supabase,
        ILogger<LemonController> logger,
        IHttpClientFactory httpFactory)
    {
        _supabase   = supabase;
        _logger     = logger;
        _httpFactory = httpFactory;
    }

    // ─── GET /api/lemon/checkout ─────────────────────────────────────────────
    // Creates a Lemon Squeezy checkout session and returns the URL.
    // Called from the settings page when the user clicks "Upgrade to Pro".

    [HttpGet("checkout")]
    [Authorize]
    public async Task<IActionResult> GetCheckoutUrl(
        [FromQuery] string plan    = "core",
        [FromQuery] string billing = "monthly")
    {
        var apiKey  = Environment.GetEnvironmentVariable("LEMON_VELACRE_API")     ?? "";
        var storeId = Environment.GetEnvironmentVariable("LEMONSQUEEZY_STORE_ID") ?? "";

        var envKey = (plan, billing) switch
        {
            ("core", "yearly")  => "LEMONSQUEEZY_VARIANT_ID_CORE_YEARLY",
            ("core", _)         => "LEMONSQUEEZY_VARIANT_ID_CORE_MONTHLY",
            ("pro",  "yearly")  => "LEMONSQUEEZY_VARIANT_ID_PRO_YEARLY",
            ("pro",  _)         => "LEMONSQUEEZY_VARIANT_ID_PRO_MONTHLY",
            _                   => ""
        };
        var variantId = string.IsNullOrEmpty(envKey)
            ? "" : Environment.GetEnvironmentVariable(envKey) ?? "";

        if (string.IsNullOrEmpty(variantId) || string.IsNullOrEmpty(storeId))
            return StatusCode(503, "Checkout not configured yet");

        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        var userResult = await _supabase.From<UsuarioEntity>()
            .Where(u => u.Id == userId).Limit(1).Get();
        var usuario = userResult.Models.FirstOrDefault();
        if (usuario == null) return NotFound("Usuario no encontrado");

        // Build the JSON:API payload for Lemon Squeezy
        var checkoutData = new Dictionary<string, object>
        {
            ["custom"] = new Dictionary<string, string> { { "user_id", userId.ToString() } },
            ["email"]  = usuario.Email ?? ""
        };

        var frontendUrl = Environment.GetEnvironmentVariable("FRONTEND_URL") ?? "https://www.velacre.com";
        var attributes = new Dictionary<string, object>
        {
            ["checkout_data"]   = checkoutData,
            ["product_options"] = new Dictionary<string, string>
            {
                ["redirect_url"] = $"{frontendUrl}/settings"
            }
        };

        var payload = new
        {
            data = new
            {
                type          = "checkouts",
                attributes,
                relationships = new
                {
                    store   = new { data = new { type = "stores",   id = storeId   } },
                    variant = new { data = new { type = "variants", id = variantId } }
                }
            }
        };

        var serializedPayload = JsonSerializer.Serialize(payload);
        var http = _httpFactory.CreateClient();
        var req  = new HttpRequestMessage(HttpMethod.Post, "https://api.lemonsqueezy.com/v1/checkouts");
        req.Headers.Add("Authorization", $"Bearer {apiKey}");
        req.Headers.Add("Accept",        "application/vnd.api+json");
        req.Content = new StringContent(serializedPayload, Encoding.UTF8, "application/vnd.api+json");

        var res  = await http.SendAsync(req);
        var body = await res.Content.ReadAsStringAsync();

        if (!res.IsSuccessStatusCode)
        {
            _logger.LogError("Lemon checkout API error {Status}: {Body}", res.StatusCode, body);
            return StatusCode(502, "Error al crear el checkout");
        }

        using var doc = JsonDocument.Parse(body);
        var url = doc.RootElement
            .GetProperty("data")
            .GetProperty("attributes")
            .GetProperty("url")
            .GetString();

        return Ok(new { url });
    }

    // ─── POST /api/lemonsqueezy/cancelar ────────────────────────────────────────
    // Cancels the active LS subscription for the authenticated user.

    [HttpPost("cancelar")]
    public async Task<IActionResult> Cancelar()
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);

        var result  = await _supabase.From<UsuarioEntity>().Where(u => u.Id == userId).Limit(1).Get();
        var usuario = result.Models.FirstOrDefault();

        if (usuario == null) return NotFound();
        _logger.LogInformation("[Cancelar] userId={UserId} plan={Plan} lsSubId={SubId}", userId, usuario.Plan, usuario.LsSubscriptionId ?? "NULL");
        if (string.IsNullOrEmpty(usuario.LsSubscriptionId))
            return BadRequest(new { error = "No hay suscripción activa", plan = usuario.Plan, lsSubId = usuario.LsSubscriptionId });

        var lsKey = Environment.GetEnvironmentVariable("LEMONSQUEEZY_API_KEY");
        var http  = _httpFactory.CreateClient();
        var req   = new HttpRequestMessage(HttpMethod.Delete,
            $"https://api.lemonsqueezy.com/v1/subscriptions/{usuario.LsSubscriptionId}");
        req.Headers.Add("Authorization", $"Bearer {lsKey}");
        req.Headers.Add("Accept", "application/vnd.api+json");

        var resp = await http.SendAsync(req);
        var body = await resp.Content.ReadAsStringAsync();

        if (!resp.IsSuccessStatusCode)
        {
            _logger.LogError("[Cancelar] LS API {Status}: {Body}", (int)resp.StatusCode, body);
            return StatusCode(502, new { error = "Error al cancelar en Lemon Squeezy" });
        }

        // Extract ends_at from response so we can show the user when access expires
        DateTimeOffset? endsAt = null;
        try
        {
            using var doc = JsonDocument.Parse(body);
            endsAt = ParseDate(doc.RootElement.GetProperty("data").GetProperty("attributes"), "ends_at");
        }
        catch { /* non-critical */ }

        // Mark as cancelled locally — webhook will confirm later
        await _supabase.From<UsuarioEntity>()
            .Where(u => u.Id == userId)
            .Set(u => u.LsStatus, "cancelled")
            .Set(u => u.LsEndsAt, endsAt)
            .Update();

        _logger.LogInformation("[Cancelar] Sub {SubId} cancelada para userId={UserId}, ends={Ends}", usuario.LsSubscriptionId, userId, endsAt);
        return Ok(new { endsAt });
    }

    // ─── POST /api/lemon/webhook ─────────────────────────────────────────────
    // Receives Lemon Squeezy subscription events and updates usuario.plan.
    // No JWT auth — verified via HMAC-SHA256 signature on raw body.

    [HttpPost("webhook")]
    [AllowAnonymous]
    public async Task<IActionResult> Webhook()
    {
        var secret = Environment.GetEnvironmentVariable("LEMONSQUEEZY_WEBHOOK_SECRET") ?? "";

        // Read raw body (EnableBuffering is registered in Program.cs)
        Request.Body.Seek(0, SeekOrigin.Begin);
        using var sr      = new StreamReader(Request.Body, Encoding.UTF8, leaveOpen: true);
        var       rawBody = await sr.ReadToEndAsync();

        // Verify signature
        if (!Request.Headers.TryGetValue("X-Signature", out var sigHeader) ||
            string.IsNullOrEmpty(sigHeader))
            return Unauthorized("Missing X-Signature");

        var expected = ComputeHmacSha256Hex(rawBody, secret);
        var received = sigHeader.ToString().ToLowerInvariant();
        if (expected != received)
        {
            _logger.LogWarning("Lemon webhook: invalid signature");
            return Unauthorized("Invalid signature");
        }

        using var doc  = JsonDocument.Parse(rawBody);
        var       root = doc.RootElement;

        var eventName = root
            .GetProperty("meta")
            .GetProperty("event_name")
            .GetString() ?? "";

        _logger.LogInformation("Lemon webhook event: {Event}", eventName);

        // Extract our user_id from custom_data
        string? userId = null;
        if (root.TryGetProperty("meta", out var meta) &&
            meta.TryGetProperty("custom_data", out var cd) &&
            cd.TryGetProperty("user_id", out var uidEl))
        {
            userId = uidEl.GetString();
        }

        if (string.IsNullOrEmpty(userId) || !Guid.TryParse(userId, out var userGuid))
        {
            _logger.LogWarning("Lemon webhook {Event}: no valid user_id in custom_data", eventName);
            return Ok(); // Return 200 so LS doesn't retry forever
        }

        var dataEl = root.GetProperty("data");
        var attrs  = dataEl.GetProperty("attributes");

        var portalUrl      = ExtractPortalUrl(dataEl);
        var subscriptionId = dataEl.TryGetProperty("id", out var idEl) ? idEl.GetString() : null;
        var lsStatus       = attrs.TryGetProperty("status",     out var stEl) ? stEl.GetString()  : null;
        var renewsAt       = ParseDate(attrs, "renews_at");
        var endsAt         = ParseDate(attrs, "ends_at");

        switch (eventName)
        {
            case "subscription_created":
            case "subscription_resumed":
                await SetPlan(userGuid, DetectPlan(dataEl), portalUrl, subscriptionId, lsStatus, renewsAt, endsAt);
                break;

            case "subscription_updated":
                // "cancelled" = usuario canceló pero sigue en período pagado → mantener plan
                // Solo bajar a basic si está paused o en otro estado no válido
                if (lsStatus is "active" or "past_due" or "cancelled")
                    await SetPlan(userGuid, DetectPlan(dataEl), portalUrl, subscriptionId, lsStatus, renewsAt, endsAt);
                else
                    await SetPlan(userGuid, "basic", portalUrl, subscriptionId, lsStatus, renewsAt, endsAt);
                break;

            case "subscription_cancelled":
                // Keep access until period ends (endsAt), plan downgrade via subscription_expired
                await SetPlan(userGuid, DetectPlan(dataEl), portalUrl, subscriptionId, lsStatus, renewsAt, endsAt);
                break;

            case "subscription_expired":
            case "subscription_paused":
                await SetPlan(userGuid, "basic", null, null, lsStatus, null, null);
                break;

            default:
                _logger.LogDebug("Lemon webhook: unhandled event {Event}", eventName);
                break;
        }

        return Ok();
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private async Task SetPlan(Guid userId, string plan, string? portalUrl, string? subscriptionId,
        string? lsStatus, DateTimeOffset? renewsAt, DateTimeOffset? endsAt)
    {
        var result  = await _supabase.From<UsuarioEntity>()
            .Where(u => u.Id == userId).Limit(1).Get();
        if (result.Models.FirstOrDefault() == null)
        {
            _logger.LogWarning("SetPlan: user {UserId} not found", userId);
            return;
        }

        var query = _supabase.From<UsuarioEntity>()
            .Where(u => u.Id == userId)
            .Set(u => u.Plan, plan);

        if (portalUrl != null)      query = query.Set(u => u.LsCustomerPortal, portalUrl);
        if (subscriptionId != null) query = query.Set(u => u.LsSubscriptionId, subscriptionId);
        else if (plan == "basic")   query = query.Set(u => u.LsSubscriptionId, (string?)null);
        if (lsStatus != null)       query = query.Set(u => u.LsStatus, lsStatus);
        query = query.Set(u => u.LsRenewsAt, renewsAt);
        query = query.Set(u => u.LsEndsAt,   endsAt);

        await query.Update();
        _logger.LogInformation("SetPlan: {UserId} → {Plan} / {Status} renews={Renews} ends={Ends}", userId, plan, lsStatus, renewsAt, endsAt);
    }

    private static DateTimeOffset? ParseDate(JsonElement attrs, string key)
    {
        try
        {
            if (attrs.TryGetProperty(key, out var el) && el.ValueKind != JsonValueKind.Null)
                if (DateTimeOffset.TryParse(el.GetString(), out var dt)) return dt;
        }
        catch { /* ignore */ }
        return null;
    }

    private static string? ExtractPortalUrl(JsonElement data)
    {
        try
        {
            if (data.TryGetProperty("attributes", out var attrs) &&
                attrs.TryGetProperty("urls", out var urls) &&
                urls.TryGetProperty("customer_portal", out var portal))
            {
                return portal.GetString();
            }
        }
        catch { /* ignore */ }
        return null;
    }

    private static string DetectPlan(JsonElement data)
    {
        var variantId = data
            .GetProperty("attributes")
            .GetProperty("variant_id")
            .GetInt32()
            .ToString();

        var coreVariants = new[]
        {
            Environment.GetEnvironmentVariable("LEMONSQUEEZY_VARIANT_ID_CORE_MONTHLY") ?? "",
            Environment.GetEnvironmentVariable("LEMONSQUEEZY_VARIANT_ID_CORE_YEARLY")  ?? ""
        };

        return coreVariants.Contains(variantId) ? "core" : "pro";
    }

    private static string ComputeHmacSha256Hex(string data, string key)
    {
        var keyBytes  = Encoding.UTF8.GetBytes(key);
        var dataBytes = Encoding.UTF8.GetBytes(data);
        var hash      = HMACSHA256.HashData(keyBytes, dataBytes);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }
}
