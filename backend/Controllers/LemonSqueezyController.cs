using Microsoft.AspNetCore.Mvc;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using backend.Models.Entities;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LemonSqueezyController : ControllerBase
{
    private readonly Supabase.Client _supabase;
    private readonly ILogger<LemonSqueezyController> _logger;
    private readonly string _webhookSecret;

    public LemonSqueezyController(Supabase.Client supabase, ILogger<LemonSqueezyController> logger)
    {
        _supabase = supabase;
        _logger = logger;
        _webhookSecret = Environment.GetEnvironmentVariable("LEMONSQUEEZY_WEBHOOK_SECRET") ?? "";
    }

    [HttpPost("webhook")]
    public async Task<IActionResult> Webhook()
    {
        // Read raw body
        Request.EnableBuffering();
        using var reader = new StreamReader(Request.Body, leaveOpen: true);
        var rawBody = await reader.ReadToEndAsync();
        Request.Body.Position = 0;

        // Verify signature
        var signature = Request.Headers["X-Signature"].FirstOrDefault() ?? "";
        if (!string.IsNullOrEmpty(_webhookSecret) && !VerifySignature(rawBody, signature))
        {
            _logger.LogWarning("[LemonSqueezy] Invalid signature");
            return Unauthorized();
        }

        JsonDocument doc;
        try { doc = JsonDocument.Parse(rawBody); }
        catch { return BadRequest(); }

        var root = doc.RootElement;
        var eventName = root.TryGetProperty("meta", out var meta) && meta.TryGetProperty("event_name", out var ev)
            ? ev.GetString() ?? "" : "";

        _logger.LogInformation("[LemonSqueezy] Event: {Event}", eventName);

        // Extract user_id from custom data
        var userIdStr = "";
        if (meta.TryGetProperty("custom_data", out var customData) && customData.TryGetProperty("user_id", out var uid))
            userIdStr = uid.GetString() ?? "";

        // Extract variant name to determine plan
        var variantName = "";
        if (root.TryGetProperty("data", out var data) && data.TryGetProperty("attributes", out var attrs))
        {
            if (attrs.TryGetProperty("variant_name", out var vn)) variantName = vn.GetString() ?? "";
        }
        var plan = variantName.ToLower().Contains("pro") ? "pro" : "basic";

        if (!Guid.TryParse(userIdStr, out var userId))
        {
            _logger.LogWarning("[LemonSqueezy] No valid user_id in custom_data");
            return Ok(); // Return 200 to prevent retries
        }

        switch (eventName)
        {
            case "subscription_created":
            case "subscription_resumed":
            case "order_created":
                await SetUserActive(userId, true, plan);
                break;
            case "subscription_cancelled":
            case "subscription_expired":
            case "subscription_paused":
                await SetUserActive(userId, false, plan);
                break;
        }

        return Ok();
    }

    private async Task SetUserActive(Guid userId, bool activo, string plan)
    {
        var result = await _supabase.From<UsuarioEntity>().Where(u => u.Id == userId).Limit(1).Get();
        var usuario = result.Models.FirstOrDefault();
        if (usuario == null) { _logger.LogWarning("[LemonSqueezy] User {UserId} not found", userId); return; }

        usuario.Activo = activo;
        usuario.Plan = plan;
        if (activo && usuario.ActivoDesde == null) usuario.ActivoDesde = DateTimeOffset.UtcNow;

        await _supabase.From<UsuarioEntity>().Where(u => u.Id == userId).Update(usuario);
        _logger.LogInformation("[LemonSqueezy] User {UserId} → activo={Activo} plan={Plan}", userId, activo, plan);
    }

    private bool VerifySignature(string payload, string signature)
    {
        var key = Encoding.UTF8.GetBytes(_webhookSecret);
        var payloadBytes = Encoding.UTF8.GetBytes(payload);
        var hash = HMACSHA256.HashData(key, payloadBytes);
        var expected = Convert.ToHexString(hash).ToLower();
        return expected == signature.ToLower();
    }
}
