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
        [FromQuery] string plan        = "core",
        [FromQuery] string billing     = "monthly",
        [FromQuery] string redirectUrl = "")
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

        var attributes = new Dictionary<string, object>
        {
            ["checkout_data"] = checkoutData
        };
        if (!string.IsNullOrEmpty(redirectUrl))
            attributes["checkout_options"] = new Dictionary<string, string> { { "redirect_url", redirectUrl } };

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
        _logger.LogInformation("Lemon checkout payload: storeId={StoreId} variantId={VariantId} apiKeyPrefix={Prefix} body={Body}",
            storeId, variantId, apiKey.Length > 10 ? apiKey[..10] : "SHORT", serializedPayload);

        var http = _httpFactory.CreateClient();
        var req  = new HttpRequestMessage(HttpMethod.Post, "https://api.lemonsqueezy.com/v1/checkouts");
        req.Headers.Add("Authorization", $"Bearer {apiKey}");
        req.Headers.Add("Accept",        "application/vnd.api+json");
        req.Content = new StringContent(
            serializedPayload, Encoding.UTF8, "application/vnd.api+json");

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

        switch (eventName)
        {
            case "subscription_created":
            case "subscription_resumed":
                await SetPlan(userGuid, "pro");
                break;

            case "subscription_updated":
                // Only downgrade if the subscription is no longer active
                var status = root
                    .GetProperty("data")
                    .GetProperty("attributes")
                    .GetProperty("status")
                    .GetString();
                var plan = status is "active" or "past_due" ? "pro" : "basic";
                await SetPlan(userGuid, plan);
                break;

            case "subscription_cancelled":
            case "subscription_expired":
            case "subscription_paused":
                await SetPlan(userGuid, "basic");
                break;

            default:
                _logger.LogDebug("Lemon webhook: unhandled event {Event}", eventName);
                break;
        }

        return Ok();
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private async Task SetPlan(Guid userId, string plan)
    {
        var result  = await _supabase.From<UsuarioEntity>()
            .Where(u => u.Id == userId).Limit(1).Get();
        var usuario = result.Models.FirstOrDefault();
        if (usuario == null)
        {
            _logger.LogWarning("SetPlan: user {UserId} not found", userId);
            return;
        }
        usuario.Plan = plan;
        await _supabase.From<UsuarioEntity>().Update(usuario);
        _logger.LogInformation("SetPlan: user {UserId} → {Plan}", userId, plan);
    }

    private static string ComputeHmacSha256Hex(string data, string key)
    {
        var keyBytes  = Encoding.UTF8.GetBytes(key);
        var dataBytes = Encoding.UTF8.GetBytes(data);
        var hash      = HMACSHA256.HashData(keyBytes, dataBytes);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }
}
