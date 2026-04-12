using backend.Models.Requests;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;

namespace backend.Controllers;

/// <summary>
/// Endpoint anónimo que recibe los reportes de error enviados desde el frontend
/// cuando el usuario pulsa "Reportar problema". Se envía un email a info@velacre.com
/// con todo el contexto del error (sin stack). Rate limit simple por IP (10/hora)
/// usando IMemoryCache para evitar abuso.
/// </summary>
[ApiController]
[Route("api/report-error")]
[AllowAnonymous]
public class ReportErrorController : ControllerBase
{
    private const int MaxReportsPerHourPerIp = 10;
    private const int MaxFieldLength = 2000;
    private const int MaxObservacionesLength = 4000;

    private readonly EmailService _email;
    private readonly IMemoryCache _cache;
    private readonly ILogger<ReportErrorController> _logger;

    public ReportErrorController(EmailService email, IMemoryCache cache, ILogger<ReportErrorController> logger)
    {
        _email = email;
        _cache = cache;
        _logger = logger;
    }

    [HttpPost]
    public async Task<IActionResult> Report([FromBody] ReportErrorRequest request)
    {
        if (request is null)
            return BadRequest(new { error = "invalid_payload" });

        // Rate limit por IP — in-memory, suficiente para una sola instancia.
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var cacheKey = $"report-error:{ip}";
        var count = _cache.GetOrCreate(cacheKey, entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(1);
            return 0;
        });

        if (count >= MaxReportsPerHourPerIp)
        {
            _logger.LogWarning("[ReportError] Rate limit alcanzado por IP {Ip}", ip);
            return StatusCode(StatusCodes.Status429TooManyRequests, new { error = "rate_limit" });
        }

        _cache.Set(cacheKey, count + 1, TimeSpan.FromHours(1));

        // Sanitización básica de los campos (trim + max length).
        var sanitized = new ReportErrorRequest
        {
            OccurredAt      = Trim(request.OccurredAt, MaxFieldLength),
            Url             = Trim(request.Url, MaxFieldLength),
            ErrorMessage    = Trim(request.ErrorMessage, MaxFieldLength),
            ErrorSource     = Trim(request.ErrorSource, 64),
            StatusCode      = request.StatusCode,
            Endpoint        = Trim(request.Endpoint, MaxFieldLength),
            LastAction      = Trim(request.LastAction, MaxFieldLength),
            UserEmail       = Trim(request.UserEmail, 320),
            UserPlan        = Trim(request.UserPlan, 32),
            UserAgent       = Trim(request.UserAgent, MaxFieldLength),
            Platform        = Trim(request.Platform, 128),
            Language        = Trim(request.Language, 32),
            Observaciones   = Trim(request.Observaciones, MaxObservacionesLength),
            ErrorId         = Trim(request.ErrorId, 128),
        };

        var reportId = $"RPT-{DateTime.UtcNow:yyyyMMdd-HHmmss}-{Random.Shared.Next(1000, 9999)}";

        try
        {
            await _email.SendErrorReportAsync(sanitized, reportId);
            _logger.LogInformation(
                "[ReportError] Reporte enviado — ReportId={ReportId}, Source={Source}, Endpoint={Endpoint}, Status={Status}",
                reportId, sanitized.ErrorSource, sanitized.Endpoint, sanitized.StatusCode);
            return Ok(new { reportId });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[ReportError] Error al enviar reporte {ReportId}", reportId);
            // Aun así devolvemos 200 con el reportId para que el usuario vea
            // confirmación — el fallo de Resend queda en logs server-side.
            return Ok(new { reportId });
        }
    }

    private static string? Trim(string? value, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var trimmed = value.Trim();
        return trimmed.Length > maxLength ? trimmed[..maxLength] : trimmed;
    }
}
