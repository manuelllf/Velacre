using System.Net.Http.Json;

namespace backend.Services;

public class EmailService
{
    private readonly HttpClient _http;
    private readonly ILogger<EmailService> _logger;
    private readonly string _apiKey;
    private readonly string _from;

    public EmailService(IHttpClientFactory httpFactory, ILogger<EmailService> logger)
    {
        _http   = httpFactory.CreateClient();
        _logger = logger;
        _apiKey = Environment.GetEnvironmentVariable("RESEND_API_KEY") ?? "";
        _from   = Environment.GetEnvironmentVariable("RESEND_FROM")    ?? "Velacre <hola@velacre.com>";
    }

    public async Task SendWelcomeAsync(string toEmail, string nombre)
    {
        if (string.IsNullOrEmpty(_apiKey))
        {
            _logger.LogWarning("[EmailService] RESEND_API_KEY no configurada, omitiendo email de bienvenida");
            return;
        }

        var html = $"""
            <!DOCTYPE html>
            <html lang="es">
            <head><meta charset="UTF-8"></head>
            <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;margin:0;padding:0;">
              <div style="max-width:520px;margin:40px auto;background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
                <div style="background:#4f46e5;padding:28px 32px;">
                  <h1 style="color:#fff;margin:0;font-size:20px;font-weight:600;letter-spacing:-0.3px;">Velacre</h1>
                </div>
                <div style="padding:32px;">
                  <h2 style="color:#0f172a;font-size:18px;font-weight:600;margin:0 0 12px;">Bienvenido{(string.IsNullOrEmpty(nombre) ? "" : $", {nombre}")} 👋</h2>
                  <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 20px;">
                    Tu cuenta en Velacre está lista. Ahora puedes conectar tu negocio de Google y empezar a generar respuestas personalizadas a tus reseñas en segundos.
                  </p>
                  <a href="https://velacre.com/onboarding"
                     style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:500;">
                    Empezar ahora
                  </a>
                  <p style="color:#94a3b8;font-size:12px;margin:28px 0 0;">
                    Si no has creado esta cuenta, puedes ignorar este mensaje.
                  </p>
                </div>
                <div style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;">
                  <p style="color:#94a3b8;font-size:11px;margin:0;">
                    © {DateTime.UtcNow.Year} Velacre · <a href="https://velacre.com/privacidad" style="color:#94a3b8;">Privacidad</a>
                  </p>
                </div>
              </div>
            </body>
            </html>
            """;

        var payload = new
        {
            from    = _from,
            to      = new[] { toEmail },
            subject = "Bienvenido a Velacre",
            html,
        };

        try
        {
            var req = new HttpRequestMessage(HttpMethod.Post, "https://api.resend.com/emails");
            req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _apiKey);
            req.Content = JsonContent.Create(payload);

            var res = await _http.SendAsync(req);
            if (res.IsSuccessStatusCode)
                _logger.LogInformation("[EmailService] Welcome email enviado a {Email}", toEmail);
            else
            {
                var body = await res.Content.ReadAsStringAsync();
                _logger.LogWarning("[EmailService] Resend respondió {Status}: {Body}", res.StatusCode, body);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[EmailService] Error enviando welcome email a {Email}", toEmail);
        }
    }
}
