using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using backend.Interfaces;
using backend.Services;

namespace backend.Controllers;

[ApiController]
[Route("api/lemonsqueezy")]
public class LemonController : ControllerBase
{
    private readonly IUsuarioRepository _usuarioRepo;
    private readonly ILogger<LemonController> _logger;
    private readonly IHttpClientFactory _httpFactory;
    private readonly EmailService _email;

    public LemonController(
        IUsuarioRepository usuarioRepo,
        ILogger<LemonController> logger,
        IHttpClientFactory httpFactory,
        EmailService email)
    {
        _usuarioRepo = usuarioRepo;
        _logger      = logger;
        _httpFactory = httpFactory;
        _email       = email;
    }

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
        var usuario = await _usuarioRepo.GetByIdAsync(userId);
        if (usuario == null) return NotFound("Usuario no encontrado");

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
                ["redirect_url"] = $"{frontendUrl}/inicio"
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

    [HttpPost("cancelar")]
    public async Task<IActionResult> Cancelar()
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);

        var usuario = await _usuarioRepo.GetByIdAsync(userId);
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

        DateTimeOffset? endsAt = null;
        try
        {
            using var doc = JsonDocument.Parse(body);
            endsAt = ParseDate(doc.RootElement.GetProperty("data").GetProperty("attributes"), "ends_at");
        }
        catch { }

        await _usuarioRepo.UpdateLsCancelAsync(userId, usuario.Plan, "cancelled", endsAt);

        _logger.LogInformation("[Cancelar] Sub {SubId} cancelada para userId={UserId}, ends={Ends}", usuario.LsSubscriptionId, userId, endsAt);
        return Ok(new { endsAt });
    }

    [HttpPost("webhook")]
    [AllowAnonymous]
    public async Task<IActionResult> Webhook()
    {
        var secret = Environment.GetEnvironmentVariable("LEMONSQUEEZY_WEBHOOK_SECRET") ?? "";

        Request.Body.Seek(0, SeekOrigin.Begin);
        using var sr      = new StreamReader(Request.Body, Encoding.UTF8, leaveOpen: true);
        var       rawBody = await sr.ReadToEndAsync();

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
            return Ok();
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
            {
                var plan = DetectPlan(dataEl);
                await SetPlan(userGuid, plan, portalUrl, subscriptionId, lsStatus, renewsAt, endsAt);
                break;
            }

            case "subscription_updated":
                if (lsStatus is "active" or "past_due" or "cancelled")
                    await SetPlan(userGuid, DetectPlan(dataEl), portalUrl, subscriptionId, lsStatus, renewsAt, endsAt);
                else
                    await SetPlan(userGuid, "basic", portalUrl, subscriptionId, lsStatus, renewsAt, endsAt);
                break;

            case "subscription_cancelled":
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

    private async Task SetPlan(Guid userId, string plan, string? portalUrl, string? subscriptionId,
        string? lsStatus, DateTimeOffset? renewsAt, DateTimeOffset? endsAt)
    {
        var usuario = await _usuarioRepo.GetByIdAsync(userId);
        if (usuario == null)
        {
            _logger.LogWarning("SetPlan: user {UserId} not found", userId);
            return;
        }

        await _usuarioRepo.UpdateLsSubscriptionAsync(userId, plan, portalUrl,
            plan == "basic" && subscriptionId == null ? null : subscriptionId,
            lsStatus, renewsAt, endsAt);

        _logger.LogInformation("SetPlan: {UserId} → {Plan} / {Status} renews={Renews} ends={Ends}", userId, plan, lsStatus, renewsAt, endsAt);
    }

    private static DateTimeOffset? ParseDate(JsonElement attrs, string key)
    {
        try
        {
            if (attrs.TryGetProperty(key, out var el) && el.ValueKind != JsonValueKind.Null)
                if (DateTimeOffset.TryParse(el.GetString(), out var dt)) return dt;
        }
        catch { }
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
        catch { }
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
