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

    public async Task SendWaitlistNotificationAsync(string userEmail, string userName, string plan, string notas)
    {
        if (string.IsNullOrEmpty(_apiKey))
        {
            _logger.LogWarning("[EmailService] RESEND_API_KEY no configurada, omitiendo email de waitlist");
            return;
        }

        var html = $"""
            <!DOCTYPE html>
            <html lang="es">
            <head><meta charset="UTF-8"></head>
            <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;margin:0;padding:0;">
              <div style="max-width:520px;margin:40px auto;background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
                <div style="background:#4f46e5;padding:28px 32px;">
                  <h1 style="color:#fff;margin:0;font-size:20px;font-weight:600;">Velacre · Lista de espera</h1>
                </div>
                <div style="padding:32px;">
                  <h2 style="color:#0f172a;font-size:18px;font-weight:600;margin:0 0 16px;">Nuevo interesado en plan <strong>{plan.ToUpper()}</strong></h2>
                  <table style="width:100%;border-collapse:collapse;font-size:14px;color:#475569;">
                    <tr><td style="padding:6px 0;font-weight:600;width:120px;">Email:</td><td style="padding:6px 0;">{userEmail}</td></tr>
                    <tr><td style="padding:6px 0;font-weight:600;">Nombre:</td><td style="padding:6px 0;">{(string.IsNullOrEmpty(userName) ? "—" : userName)}</td></tr>
                    <tr><td style="padding:6px 0;font-weight:600;">Plan:</td><td style="padding:6px 0;">{plan}</td></tr>
                    <tr><td style="padding:6px 0;font-weight:600;vertical-align:top;">Notas:</td><td style="padding:6px 0;">{(string.IsNullOrEmpty(notas) ? "—" : notas)}</td></tr>
                  </table>
                </div>
                <div style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;">
                  <p style="color:#94a3b8;font-size:11px;margin:0;">Velacre · Notificación automática de lista de espera</p>
                </div>
              </div>
            </body>
            </html>
            """;

        var payload = new
        {
            from    = _from,
            to      = new[] { "infovelacre@gmail.com" },
            subject = $"[Waitlist] {userName ?? userEmail} quiere el plan {plan.ToUpper()}",
            html,
        };

        try
        {
            var req = new HttpRequestMessage(HttpMethod.Post, "https://api.resend.com/emails");
            req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _apiKey);
            req.Content = System.Net.Http.Json.JsonContent.Create(payload);

            var res = await _http.SendAsync(req);
            if (res.IsSuccessStatusCode)
                _logger.LogInformation("[EmailService] Waitlist email enviado — {Email} quiere plan {Plan}", userEmail, plan);
            else
            {
                var body = await res.Content.ReadAsStringAsync();
                _logger.LogWarning("[EmailService] Resend respondió {Status}: {Body}", res.StatusCode, body);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[EmailService] Error enviando waitlist email");
        }
    }

    public async Task SendRetainedReviewAlertAsync(string toEmail, string negocioNombre, string reviewText, string motivo)
    {
        if (string.IsNullOrEmpty(_apiKey))
        {
            _logger.LogWarning("[EmailService] RESEND_API_KEY no configurada, omitiendo alerta de reseña retenida");
            return;
        }

        var motivoLabel = motivo switch
        {
            "intoxicacion"   => "posible intoxicación alimentaria o enfermedad grave",
            "maltrato"       => "acusaciones de malos tratos o agresión",
            "amenaza_legal"  => "amenaza de denuncia o demanda judicial",
            "datos_personales" => "datos personales sensibles del cliente",
            _ => "contenido que requiere revisión manual"
        };

        var reviewPreview = reviewText.Length > 300 ? reviewText[..300] + "…" : reviewText;

        var html = $"""
            <!DOCTYPE html>
            <html lang="es">
            <head><meta charset="UTF-8"></head>
            <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;margin:0;padding:0;">
              <div style="max-width:520px;margin:40px auto;background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
                <div style="background:#dc2626;padding:28px 32px;">
                  <h1 style="color:#fff;margin:0;font-size:20px;font-weight:600;">⚠️ Velacre · Reseña retenida</h1>
                </div>
                <div style="padding:32px;">
                  <h2 style="color:#0f172a;font-size:16px;font-weight:600;margin:0 0 12px;">
                    Se ha retenido una reseña de <strong>{negocioNombre}</strong> para revisión manual
                  </h2>
                  <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:12px 16px;margin-bottom:16px;">
                    <p style="color:#991b1b;font-size:13px;font-weight:600;margin:0 0 4px;">Motivo detectado:</p>
                    <p style="color:#7f1d1d;font-size:13px;margin:0;">{motivoLabel}</p>
                  </div>
                  <p style="color:#475569;font-size:13px;font-weight:600;margin:0 0 6px;">Texto de la reseña:</p>
                  <div style="background:#f8fafc;border-left:3px solid #dc2626;padding:12px 16px;border-radius:0 6px 6px 0;margin-bottom:20px;">
                    <p style="color:#334155;font-size:13px;line-height:1.6;margin:0;font-style:italic;">"{reviewPreview}"</p>
                  </div>
                  <p style="color:#475569;font-size:13px;line-height:1.6;margin:0 0 20px;">
                    Velacre no ha generado respuesta automática para esta reseña.
                    <strong>Requiere tu atención directa</strong> — accede al dashboard para gestionarla manualmente.
                  </p>
                  <a href="https://www.velacre.com/dashboard"
                     style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:500;">
                    Ver en el dashboard →
                  </a>
                </div>
                <div style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;">
                  <p style="color:#94a3b8;font-size:11px;margin:0;">© {DateTime.UtcNow.Year} Velacre · Alerta de seguridad automática</p>
                </div>
              </div>
            </body>
            </html>
            """;

        var payload = new
        {
            from    = _from,
            to      = new[] { toEmail },
            subject = $"⚠️ [{negocioNombre}] Reseña retenida: {motivoLabel}",
            html,
        };

        try
        {
            var req = new HttpRequestMessage(HttpMethod.Post, "https://api.resend.com/emails");
            req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _apiKey);
            req.Content = System.Net.Http.Json.JsonContent.Create(payload);

            var res = await _http.SendAsync(req);
            if (res.IsSuccessStatusCode)
                _logger.LogInformation("[EmailService] Alerta retenida enviada a {Email}", toEmail);
            else
            {
                var body = await res.Content.ReadAsStringAsync();
                _logger.LogWarning("[EmailService] Resend respondió {Status}: {Body}", res.StatusCode, body);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[EmailService] Error enviando alerta de reseña retenida a {Email}", toEmail);
        }
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
                <div style="background:#2563eb;padding:28px 32px;">
                  <h1 style="color:#fff;margin:0;font-size:20px;font-weight:600;letter-spacing:-0.3px;">Velacre</h1>
                </div>
                <div style="padding:32px;">
                  <h2 style="color:#0f172a;font-size:18px;font-weight:600;margin:0 0 12px;">Bienvenido{(string.IsNullOrEmpty(nombre) ? "" : $", {nombre}")} 👋</h2>
                  <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 20px;">
                    Tu cuenta en Velacre está lista. Conecta tu negocio y empieza a generar respuestas personalizadas a tus reseñas en segundos.
                  </p>
                  <a href="https://www.velacre.com/onboarding"
                     style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:500;">
                    Empezar ahora
                  </a>
                  <p style="color:#94a3b8;font-size:12px;margin:28px 0 0;">
                    Si no has creado esta cuenta, puedes ignorar este mensaje.
                  </p>
                </div>
                <div style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;">
                  <p style="color:#94a3b8;font-size:11px;margin:0;">
                    © {DateTime.UtcNow.Year} Velacre · <a href="https://www.velacre.com/privacidad" style="color:#94a3b8;">Privacidad</a>
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

    private async Task SendEmailAsync(string toEmail, string subject, string html, string logTag)
    {
        if (string.IsNullOrEmpty(_apiKey)) return;
        var payload = new { from = _from, to = new[] { toEmail }, subject, html };
        try
        {
            var req = new HttpRequestMessage(HttpMethod.Post, "https://api.resend.com/emails");
            req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _apiKey);
            req.Content = JsonContent.Create(payload);
            var res = await _http.SendAsync(req);
            if (res.IsSuccessStatusCode)
                _logger.LogInformation("[EmailService] {Tag} enviado a {Email}", logTag, toEmail);
            else
            {
                var body = await res.Content.ReadAsStringAsync();
                _logger.LogWarning("[EmailService] {Tag} Resend {Status}: {Body}", logTag, res.StatusCode, body);
            }
        }
        catch (Exception ex) { _logger.LogError(ex, "[EmailService] Error {Tag} a {Email}", logTag, toEmail); }
    }

    private static string EmailLayout(string headerColor, string content) => $"""
        <!DOCTYPE html>
        <html lang="es">
        <head><meta charset="UTF-8"></head>
        <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;margin:0;padding:0;">
          <div style="max-width:520px;margin:40px auto;background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
            <div style="background:{headerColor};padding:24px 32px;">
              <h1 style="color:#fff;margin:0;font-size:18px;font-weight:600;letter-spacing:-0.3px;">Velacre</h1>
            </div>
            <div style="padding:32px;">{content}</div>
            <div style="background:#f8fafc;padding:14px 32px;border-top:1px solid #e2e8f0;">
              <p style="color:#94a3b8;font-size:11px;margin:0;">© {DateTime.UtcNow.Year} Velacre · <a href="https://www.velacre.com/privacidad" style="color:#94a3b8;">Privacidad</a></p>
            </div>
          </div>
        </body>
        </html>
        """;

    public async Task SendSubscriptionConfirmedAsync(string toEmail, string nombre, string plan)
    {
        var planLabel = plan.ToUpper() == "PRO" ? "Pro" : "Core";
        var content = $"""
            <h2 style="color:#0f172a;font-size:18px;font-weight:600;margin:0 0 12px;">¡Ya tienes el plan {planLabel}! 🎉</h2>
            <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 20px;">
              {(string.IsNullOrEmpty(nombre) ? "Tu" : $"{nombre}, tu")} suscripción a Velacre {planLabel} está activa.
              Entra al dashboard y empieza a sacarle partido.
            </p>
            <a href="https://www.velacre.com/dashboard"
               style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:500;">
              Ir al dashboard
            </a>
            <p style="color:#94a3b8;font-size:12px;margin:28px 0 0;">
              Gestiona tu suscripción en cualquier momento desde Configuración → Gestionar suscripción.
            </p>
            """;
        await SendEmailAsync(toEmail, $"¡Bienvenido a Velacre {planLabel}!", EmailLayout("#2563eb", content), "SubscriptionConfirmed");
    }

    public async Task SendSubscriptionCancelledAsync(string toEmail, string nombre, string plan, DateTimeOffset? endsAt)
    {
        var planLabel = plan.ToUpper() == "PRO" ? "Pro" : "Core";
        var accessInfo = endsAt.HasValue
            ? $"Seguirás teniendo acceso hasta el <strong>{endsAt.Value.ToString("d 'de' MMMM 'de' yyyy", new System.Globalization.CultureInfo("es-ES"))}</strong>."
            : "Seguirás teniendo acceso hasta que finalice tu período actual.";
        var content = $"""
            <h2 style="color:#0f172a;font-size:18px;font-weight:600;margin:0 0 12px;">Suscripción cancelada</h2>
            <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 12px;">
              {(string.IsNullOrEmpty(nombre) ? "Hemos" : $"{nombre}, hemos")} procesado la cancelación de tu plan {planLabel}.
            </p>
            <div style="background:#fefce8;border:1px solid #fde68a;border-radius:6px;padding:12px 16px;margin:0 0 20px;">
              <p style="color:#92400e;font-size:13px;margin:0;">{accessInfo}</p>
            </div>
            <a href="https://www.velacre.com/settings"
               style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:500;">
              Volver a suscribirte
            </a>
            """;
        await SendEmailAsync(toEmail, "Has cancelado tu suscripción a Velacre", EmailLayout("#64748b", content), "SubscriptionCancelled");
    }

    public async Task SendSubscriptionExpiredAsync(string toEmail, string nombre)
    {
        var content = $"""
            <h2 style="color:#0f172a;font-size:18px;font-weight:600;margin:0 0 12px;">Tu suscripción ha expirado</h2>
            <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 20px;">
              {(string.IsNullOrEmpty(nombre) ? "Tu" : $"{nombre}, tu")} plan de Velacre ha expirado y tu cuenta ha pasado al plan gratuito.
              Puedes volver a activarla cuando quieras sin perder tus datos.
            </p>
            <a href="https://www.velacre.com/settings"
               style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:500;">
              Reactivar mi plan
            </a>
            """;
        await SendEmailAsync(toEmail, "Tu suscripción a Velacre ha expirado", EmailLayout("#64748b", content), "SubscriptionExpired");
    }
}
