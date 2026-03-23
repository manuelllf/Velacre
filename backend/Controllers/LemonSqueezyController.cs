using Microsoft.AspNetCore.Authorization;
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
    private readonly string _variantBasic;
    private readonly string _variantPro;

    public LemonSqueezyController(Supabase.Client supabase, ILogger<LemonSqueezyController> logger)
    {
        _supabase = supabase;
        _logger = logger;
        _webhookSecret = Environment.GetEnvironmentVariable("LEMONSQUEEZY_WEBHOOK_SECRET") ?? "";
        _variantBasic = Environment.GetEnvironmentVariable("LEMON_VARIANT_BASIC") ?? "";
        _variantPro = Environment.GetEnvironmentVariable("LEMON_VARIANT_PRO") ?? "";
    }

    [HttpPost("webhook")]
    [AllowAnonymous]
    public async Task<IActionResult> Webhook()
    {
        // Read raw body
        Request.EnableBuffering();
        using var reader = new StreamReader(Request.Body, leaveOpen: true);
        var rawBody = await reader.ReadToEndAsync();
        Request.Body.Position = 0;

        // Verify HMAC-SHA256 signature
        var signature = Request.Headers["X-Signature"].FirstOrDefault() ?? "";
        if (!string.IsNullOrEmpty(_webhookSecret) && !VerifySignature(rawBody, signature))
        {
            _logger.LogWarning("[LemonSqueezy] Firma inválida");
            return Unauthorized();
        }

        JsonDocument doc;
        try
        {
            doc = JsonDocument.Parse(rawBody);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[LemonSqueezy] Error parseando JSON del webhook");
            return Ok(); // Return 200 to prevent retries
        }

        try
        {
            var root = doc.RootElement;

            // Extract event name from meta.event_name
            var eventName = "";
            if (root.TryGetProperty("meta", out var meta) && meta.TryGetProperty("event_name", out var ev))
                eventName = ev.GetString() ?? "";

            _logger.LogInformation("[LemonSqueezy] Evento recibido: {Event}", eventName);

            // Extract from data.attributes
            var userEmail = "";
            var status = "";
            var variantId = "";

            if (root.TryGetProperty("data", out var data) && data.TryGetProperty("attributes", out var attrs))
            {
                if (attrs.TryGetProperty("user_email", out var emailProp)) userEmail = emailProp.GetString() ?? "";
                if (attrs.TryGetProperty("status", out var statusProp)) status = statusProp.GetString() ?? "";
                if (attrs.TryGetProperty("variant_id", out var variantProp))
                    variantId = variantProp.ValueKind == JsonValueKind.Number
                        ? variantProp.GetInt64().ToString()
                        : variantProp.GetString() ?? "";
            }

            // Determine plan from variantId
            var plan = DeterminePlan(variantId);

            _logger.LogInformation("[LemonSqueezy] email={Email}, status={Status}, variantId={VariantId}, plan={Plan}", userEmail, status, variantId, plan);

            if (string.IsNullOrWhiteSpace(userEmail))
            {
                _logger.LogWarning("[LemonSqueezy] No se encontró user_email en el webhook");
                return Ok();
            }

            // Find usuario by email
            var result = await _supabase.From<UsuarioEntity>()
                .Where(u => u.Email == userEmail)
                .Limit(1)
                .Get();

            var usuario = result.Models.FirstOrDefault();
            if (usuario == null)
            {
                _logger.LogWarning("[LemonSqueezy] Usuario no encontrado para email={Email}", userEmail);
                return Ok();
            }

            switch (eventName)
            {
                case "subscription_created":
                case "order_created":
                    usuario.Activo = true;
                    if (usuario.ActivoDesde == null) usuario.ActivoDesde = DateTimeOffset.UtcNow;
                    usuario.Plan = plan;
                    await _supabase.From<UsuarioEntity>().Where(u => u.Id == usuario.Id).Update(usuario);
                    _logger.LogInformation("[LemonSqueezy] Usuario {UserId} activado con plan={Plan}", usuario.Id, plan);
                    break;

                case "subscription_updated":
                    usuario.Plan = plan;
                    usuario.Activo = status == "active";
                    await _supabase.From<UsuarioEntity>().Where(u => u.Id == usuario.Id).Update(usuario);
                    _logger.LogInformation("[LemonSqueezy] Usuario {UserId} actualizado — activo={Activo}, plan={Plan}", usuario.Id, usuario.Activo, plan);
                    break;

                case "subscription_cancelled":
                case "subscription_expired":
                    usuario.Activo = false;
                    await _supabase.From<UsuarioEntity>().Where(u => u.Id == usuario.Id).Update(usuario);
                    _logger.LogInformation("[LemonSqueezy] Usuario {UserId} desactivado", usuario.Id);
                    break;

                default:
                    _logger.LogInformation("[LemonSqueezy] Evento no manejado: {Event}", eventName);
                    break;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[LemonSqueezy] Error procesando webhook");
        }

        return Ok();
    }

    private string DeterminePlan(string variantId)
    {
        if (!string.IsNullOrWhiteSpace(_variantPro) && variantId == _variantPro)
            return "pro";
        if (!string.IsNullOrWhiteSpace(_variantBasic) && variantId == _variantBasic)
            return "basic";
        return "basic"; // safe default
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
