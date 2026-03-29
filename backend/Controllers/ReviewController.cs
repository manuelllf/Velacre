using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using backend.Interfaces;
using backend.Models.Entities;
using backend.Models.Requests;
using backend.Models.Responses;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ReviewController : ControllerBase
{
    private readonly IReviewAiService _aiService;
    private readonly Supabase.Client _supabase;
    private readonly ILogger<ReviewController> _logger;

    public ReviewController(IReviewAiService aiService, Supabase.Client supabase, ILogger<ReviewController> logger)
    {
        _aiService = aiService;
        _supabase = supabase;
        _logger = logger;
    }

    [HttpPost("generate")]
    public async Task<IActionResult> GenerateResponse([FromBody] GenerateReviewRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.ReviewText))
            return BadRequest("La reseña no puede estar vacía.");

        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        _logger.LogInformation("[ReviewController] POST /generate — userId={UserId}, plataforma={Plataforma}", userId, request.Plataforma);

        // Check plan limits for manual generation
        var usuarioResult = await _supabase.From<UsuarioEntity>()
            .Where(u => u.Id == userId)
            .Limit(1)
            .Get();

        var usuario = usuarioResult.Models.FirstOrDefault();

        if (usuario != null)
        {
            var now = DateTimeOffset.UtcNow;

            // Verificar estado: baneado o prueba expirada → bloquear
            if (usuario.Estado == "baneado")
            {
                _logger.LogWarning("[ReviewController] Usuario {UserId} baneado intentó generar respuesta", userId);
                return StatusCode(403, "Tu cuenta está suspendida. Contacta con soporte.");
            }
            if (usuario.Estado == "prueba" && usuario.PruebaHasta.HasValue && usuario.PruebaHasta.Value < now)
            {
                _logger.LogWarning("[ReviewController] Usuario {UserId} con prueba expirada intentó generar respuesta", userId);
                return StatusCode(403, "Tu período de prueba ha expirado. Contacta con soporte para activar tu cuenta.");
            }

            // Pro efectivo: plan pro O override activo
            var esProEfectivo = usuario.Plan == "pro" ||
                (usuario.ProOverride && (!usuario.ProOverrideHasta.HasValue || usuario.ProOverrideHasta.Value > now));

            // Límite de respuestas manuales solo para no-Pro
            if (!esProEfectivo)
            {
                // Reset counter if it's a new month
                if (usuario.RespuestasMesReset == null ||
                    usuario.RespuestasMesReset.Value.Year < now.Year ||
                    (usuario.RespuestasMesReset.Value.Year == now.Year && usuario.RespuestasMesReset.Value.Month < now.Month))
                {
                    usuario.RespuestasManualesMes = 0;
                    await _supabase.From<UsuarioEntity>().Where(u => u.Id == userId).Update(usuario);
                }

                if (usuario.RespuestasManualesMes >= 3)
                {
                    _logger.LogWarning("[ReviewController] Usuario {UserId} alcanzó límite de 3 respuestas manuales en plan basic", userId);
                    return StatusCode(403, "Has alcanzado el límite de 30 respuestas manuales este mes. Actualiza a Pro para respuestas ilimitadas.");
                }
            }
        }

        var negocioResult = await _supabase.From<NegocioEntity>()
            .Where(n => n.IdUsuario == userId)
            .Limit(1)
            .Get();

        var negocio = negocioResult.Models.FirstOrDefault();

        if (negocio == null)
        {
            _logger.LogWarning("[ReviewController] userId={UserId} no tiene negocio registrado", userId);
            return NotFound("No tienes ningún negocio registrado. Completa el onboarding primero.");
        }

        _logger.LogDebug("[ReviewController] Generando respuestas para negocio={NegocioId}", negocio.Id);

        try
        {
            var (profesional, cercano, directo) = await _aiService.GenerateThreeResponsesAsync(
                request.ReviewText,
                negocio.Descripcion ?? negocio.Nombre
            );

            _logger.LogInformation("[ReviewController] Respuestas generadas OK, guardando en BD...");

            var entity = new ReviewEntity
            {
                Codigo = "BFK" + Guid.NewGuid().ToString("N")[..7].ToUpper(),
                IdNegocio = negocio.Id,
                ClienteReview = request.ReviewText,
                RespuestaProfesional = profesional,
                RespuestaCercano = cercano,
                RespuestaDirecto = directo,
                Plataforma = request.Plataforma,
                CreadoPor = userId,
                CreadoFecha = DateTimeOffset.UtcNow
            };

            var result = await _supabase.From<ReviewEntity>().Insert(entity);

            if (result.Models.Count == 0)
            {
                _logger.LogError("[ReviewController] Insert de review devolvió 0 modelos, negocioId={NegocioId}", negocio.Id);
                return StatusCode(500, "Las respuestas se generaron pero no se pudieron guardar.");
            }

            var saved = result.Models[0];
            _logger.LogInformation("[ReviewController] Review guardada: {ReviewId} ({Codigo})", saved.Id, saved.Codigo);

            // Increment monthly counter for non-Pro users
            var esProEfectivoPostGen = usuario != null && (usuario.Plan == "pro" ||
                (usuario.ProOverride && (!usuario.ProOverrideHasta.HasValue || usuario.ProOverrideHasta.Value > DateTimeOffset.UtcNow)));
            if (usuario != null && !esProEfectivoPostGen)
            {
                usuario.RespuestasManualesMes += 1;
                if (usuario.RespuestasMesReset == null) usuario.RespuestasMesReset = DateTimeOffset.UtcNow;
                await _supabase.From<UsuarioEntity>().Where(u => u.Id == userId).Update(usuario);
                _logger.LogDebug("[ReviewController] Contador manual incrementado → {Count}/30 para userId={UserId}", usuario.RespuestasManualesMes, userId);
            }

            return Ok(new GenerateReviewResponse(profesional, cercano, directo, saved.Id, saved.Codigo));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[ReviewController] Error al generar/guardar review para userId={UserId}", userId);
            return StatusCode(500, ex.Message);
        }
    }

    [HttpGet("pending")]
    public async Task<IActionResult> GetPendingReviews()
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        _logger.LogInformation("[ReviewController] GET /pending — userId={UserId}", userId);

        var negocioResult = await _supabase.From<NegocioEntity>()
            .Where(n => n.IdUsuario == userId)
            .Limit(1)
            .Get();

        var negocio = negocioResult.Models.FirstOrDefault();

        if (negocio == null)
        {
            _logger.LogWarning("[ReviewController] userId={UserId} no tiene negocio registrado", userId);
            return NotFound("No tienes ningún negocio registrado. Completa el onboarding primero.");
        }

        var reviewsResult = await _supabase.From<ReviewEntity>()
            .Where(r => r.IdNegocio == negocio.Id)
            .Get();

        var pending = reviewsResult.Models
            .Where(r => r.RespuestaProfesional == null && r.RespuestaCercano == null && r.RespuestaDirecto == null)
            .OrderByDescending(r => r.ReviewDate ?? r.CreadoFecha)
            .Select(r => new
            {
                id = r.Id,
                googleReviewId = r.GoogleReviewId,
                authorName = r.AuthorName,
                starRating = r.StarRating,
                reviewDate = r.ReviewDate ?? r.CreadoFecha,
                clientereview = r.ClienteReview,
                reviewLanguage = r.ReviewLanguage,
                estado = r.Estado,
                respuestaProfesional = r.RespuestaProfesional,
                respuestaCercano = r.RespuestaCercano,
                respuestaDirecto = r.RespuestaDirecto,
                tonoGenerado = r.TonoGenerado
            })
            .ToList();

        _logger.LogInformation("[ReviewController] GET /pending ← {Count} reseñas pendientes para negocioId={NegocioId}", pending.Count, negocio.Id);
        return Ok(pending);
    }

    [HttpPost("{id}/generate")]
    public async Task<IActionResult> GenerateForReview(Guid id)
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        _logger.LogInformation("[ReviewController] POST /{ReviewId}/generate — userId={UserId}", id, userId);

        var negocioResult = await _supabase.From<NegocioEntity>()
            .Where(n => n.IdUsuario == userId)
            .Limit(1)
            .Get();

        var negocio = negocioResult.Models.FirstOrDefault();

        if (negocio == null)
        {
            _logger.LogWarning("[ReviewController] userId={UserId} no tiene negocio registrado", userId);
            return NotFound("No tienes ningún negocio registrado. Completa el onboarding primero.");
        }

        var reviewResult = await _supabase.From<ReviewEntity>()
            .Where(r => r.Id == id && r.IdNegocio == negocio.Id)
            .Limit(1)
            .Get();

        var review = reviewResult.Models.FirstOrDefault();

        if (review == null)
        {
            _logger.LogWarning("[ReviewController] Reseña {ReviewId} no encontrada para negocioId={NegocioId}", id, negocio.Id);
            return NotFound("Reseña no encontrada.");
        }

        // ── Plan limit check ──────────────────────────────────────────────────
        var usuarioRes = await _supabase.From<UsuarioEntity>().Where(u => u.Id == userId).Limit(1).Get();
        var usuario    = usuarioRes.Models.FirstOrDefault();
        if (usuario != null)
        {
            var now = DateTimeOffset.UtcNow;
            var esProEfectivo = usuario.Plan == "pro" ||
                (usuario.ProOverride && (!usuario.ProOverrideHasta.HasValue || usuario.ProOverrideHasta.Value > now));

            if (!esProEfectivo && usuario.Plan == "core")
            {
                // Reset contador si es nuevo mes
                if (usuario.RespuestasIaMesReset == null ||
                    usuario.RespuestasIaMesReset.Value.Year  < now.Year ||
                    (usuario.RespuestasIaMesReset.Value.Year == now.Year && usuario.RespuestasIaMesReset.Value.Month < now.Month))
                {
                    await _supabase.From<UsuarioEntity>().Where(u => u.Id == userId)
                        .Set(u => u.RespuestasIaMes, 0)
                        .Set(u => u.RespuestasIaMesReset, now)
                        .Update();
                    usuario.RespuestasIaMes = 0;
                }

                if (usuario.RespuestasIaMes >= 10)
                {
                    _logger.LogWarning("[ReviewController] Core limit alcanzado para userId={UserId} ({Count}/10)", userId, usuario.RespuestasIaMes);
                    return StatusCode(429, new { error = "limit_reached", plan = "core", limit = 10, used = usuario.RespuestasIaMes });
                }
            }
        }
        // ─────────────────────────────────────────────────────────────────────

        var tone = negocio.TonoPredefinido;
        var toneLower = tone.ToLower();

        // Only generate if that tone field is still null
        var alreadyGenerated = toneLower switch
        {
            "cercano" => review.RespuestaCercano,
            "directo" => review.RespuestaDirecto,
            _ => review.RespuestaProfesional
        };

        if (!string.IsNullOrEmpty(alreadyGenerated))
        {
            _logger.LogInformation("[ReviewController] Tono {Tone} ya generado para reviewId={ReviewId}", tone, id);
            return Ok(new { response = alreadyGenerated, tono = tone });
        }

        _logger.LogDebug("[ReviewController] Generando respuesta para reviewId={ReviewId}, tono={Tone}", id, tone);

        // Build review context — use star rating when text is absent
        var reviewContext = !string.IsNullOrWhiteSpace(review.ClienteReview)
            ? review.ClienteReview
            : review.StarRating.HasValue
                ? $"[Reseña sin texto] {review.StarRating} estrella{(review.StarRating != 1 ? "s" : "")} de {review.AuthorName ?? "un cliente"}. No dejó comentario escrito."
                : $"[Reseña sin texto] de {review.AuthorName ?? "un cliente"}. No dejó comentario escrito.";

        try
        {
            // Siempre usar el método con contexto: genera respuesta en el idioma de la reseña
            // + contexto en español para el propietario
            var lang = string.IsNullOrEmpty(review.ReviewLanguage) ? "es" : review.ReviewLanguage;
            var result = await _aiService.GenerateSingleResponseWithContextAsync(
                reviewContext,
                negocio.Descripcion ?? negocio.Nombre,
                tone,
                lang
            );
            var generated         = result.Response;
            var contextoCliente   = result.ContextoCliente;
            var contextoRespuesta = result.ContextoRespuesta;

            switch (toneLower)
            {
                case "cercano":
                    review.RespuestaCercano = generated;
                    break;
                case "directo":
                    review.RespuestaDirecto = generated;
                    break;
                default:
                    review.RespuestaProfesional = generated;
                    break;
            }
            review.TonoGenerado = tone;
            review.ActualizadoPor = userId;
            review.ActualizadoFecha = DateTimeOffset.UtcNow;

            await _supabase.From<ReviewEntity>()
                .Where(r => r.Id == review.Id)
                .Update(review);

            _logger.LogInformation("[ReviewController] Respuesta generada y guardada para reviewId={ReviewId}", id);

            // Increment IA counter for Core plan
            if (usuario != null && usuario.Plan == "core")
            {
                var now2 = DateTimeOffset.UtcNow;
                await _supabase.From<UsuarioEntity>().Where(u => u.Id == userId)
                    .Set(u => u.RespuestasIaMes, usuario.RespuestasIaMes + 1)
                    .Set(u => u.RespuestasIaMesReset, usuario.RespuestasIaMesReset ?? now2)
                    .Update();
            }

            return Ok(new
            {
                response          = generated,
                tono              = tone,
                contextoCliente   = contextoCliente,
                contextoRespuesta = contextoRespuesta
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[ReviewController] Error generando respuesta para reviewId={ReviewId}", id);
            return StatusCode(500, ex.Message);
        }
    }

    [HttpGet("all")]
    public async Task<IActionResult> GetAllReviews()
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);

        var negocioResult = await _supabase.From<NegocioEntity>()
            .Where(n => n.IdUsuario == userId).Limit(1).Get();
        var negocio = negocioResult.Models.FirstOrDefault();
        if (negocio == null) return NotFound();

        var reviewsResult = await _supabase.From<ReviewEntity>()
            .Where(r => r.IdNegocio == negocio.Id).Get();

        var all = reviewsResult.Models
            .OrderByDescending(r => r.ReviewDate ?? r.CreadoFecha)
            .Select(r => new
            {
                id = r.Id,
                googleReviewId = r.GoogleReviewId,
                authorName = r.AuthorName,
                starRating = r.StarRating,
                reviewDate = r.ReviewDate ?? r.CreadoFecha,
                clientereview = r.ClienteReview,
                estado = r.Estado,
                respuestaProfesional = r.RespuestaProfesional,
                respuestaCercano = r.RespuestaCercano,
                respuestaDirecto = r.RespuestaDirecto,
                tonoGenerado = r.TonoGenerado,
            })
            .ToList();

        return Ok(all);
    }

    [HttpPost("{id}/translate")]
    public async Task<IActionResult> TranslateReview(Guid id)
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);

        var negocioResult = await _supabase.From<NegocioEntity>().Where(n => n.IdUsuario == userId).Limit(1).Get();
        var negocio = negocioResult.Models.FirstOrDefault();
        if (negocio == null) return NotFound();

        var reviewResult = await _supabase.From<ReviewEntity>()
            .Where(r => r.Id == id && r.IdNegocio == negocio.Id)
            .Limit(1).Get();
        var review = reviewResult.Models.FirstOrDefault();
        if (review == null) return NotFound("Reseña no encontrada.");

        if (string.IsNullOrWhiteSpace(review.ClienteReview))
            return BadRequest("La reseña no tiene texto para traducir.");

        var prompt = $"Traduce al español este texto de una reseña de cliente. Devuelve SOLO la traducción, sin explicaciones ni comillas:\n\n{review.ClienteReview}";

        try
        {
            var translation = await _aiService.GetClaudeMessageAsync(prompt, "");
            return Ok(new { translation = translation.Trim() });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[ReviewController] Error traduciendo reviewId={ReviewId}", id);
            return StatusCode(500, "Error al traducir la reseña.");
        }
    }

    /// <summary>
    /// Traduce al español la respuesta ya generada para una reseña.
    /// Útil cuando la reseña es en otro idioma y el propietario quiere revisar la respuesta antes de publicarla.
    /// </summary>
    [HttpPost("{id}/translate-response")]
    public async Task<IActionResult> TranslateResponse(Guid id)
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);

        var negocioResult = await _supabase.From<NegocioEntity>().Where(n => n.IdUsuario == userId).Limit(1).Get();
        var negocio = negocioResult.Models.FirstOrDefault();
        if (negocio == null) return NotFound();

        var reviewResult = await _supabase.From<ReviewEntity>()
            .Where(r => r.Id == id && r.IdNegocio == negocio.Id)
            .Limit(1).Get();
        var review = reviewResult.Models.FirstOrDefault();
        if (review == null) return NotFound("Reseña no encontrada.");

        // Leer la respuesta generada según el tono usado
        var toneLower = (review.TonoGenerado ?? negocio.TonoPredefinido).ToLower();
        var responseText = toneLower switch
        {
            "cercano" => review.RespuestaCercano,
            "directo" => review.RespuestaDirecto,
            _         => review.RespuestaProfesional
        };

        if (string.IsNullOrWhiteSpace(responseText))
            return BadRequest("No hay respuesta generada para traducir.");

        var prompt = $"Traduce al español este texto de respuesta a una reseña. Devuelve SOLO la traducción, sin explicaciones ni comillas:\n\n{responseText}";

        try
        {
            var translation = await _aiService.GetClaudeMessageAsync(prompt, "");
            return Ok(new { translation = translation.Trim() });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[ReviewController] Error traduciendo respuesta para reviewId={ReviewId}", id);
            return StatusCode(500, "Error al traducir la respuesta.");
        }
    }

    /// <summary>
    /// Métricas de rentabilidad Velacre.
    /// is_velacre_response = tonoGenerado != null AND tonoGenerado != "google"
    /// No necesita columna nueva: tonoGenerado ya captura el origen de la respuesta.
    /// </summary>
    [HttpGet("metrics")]
    public async Task<IActionResult> GetMetrics()
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        var negocioResult = await _supabase.From<NegocioEntity>().Where(n => n.IdUsuario == userId).Limit(1).Get();
        var negocio = negocioResult.Models.FirstOrDefault();
        if (negocio == null) return NotFound();

        var reviewsResult = await _supabase.From<ReviewEntity>().Where(r => r.IdNegocio == negocio.Id).Get();
        var reviews = reviewsResult.Models;

        var total = reviews.Count;
        var velacreCount = reviews.Count(r => r.TonoGenerado != null && r.TonoGenerado != "google");
        var timeSavedMinutes = velacreCount * 4;

        // Tasa de respuesta: histórico (antes de los últimos 3 meses) vs reciente
        var cutoff = DateTimeOffset.UtcNow.AddMonths(-3);
        var recent = reviews.Where(r => r.ReviewDate >= cutoff).ToList();
        var historic = reviews.Where(r => r.ReviewDate < cutoff).ToList();

        double currentRate = recent.Count > 0
            ? (double)recent.Count(r => r.TonoGenerado != null) / recent.Count * 100 : 0;
        double historicRate = historic.Count > 0
            ? (double)historic.Count(r => r.TonoGenerado != null) / historic.Count * 100 : 0;

        return Ok(new
        {
            total,
            velacreCount,
            timeSavedMinutes,
            currentResponseRate = Math.Round(currentRate, 1),
            historicResponseRate = Math.Round(historicRate, 1),
            improvement = Math.Round(currentRate - historicRate, 1)
        });
    }

    // GET /api/review/analysis — carga el análisis más reciente de BD si existe
    [HttpGet("analysis")]
    public async Task<IActionResult> GetAnalysis()
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        var negocioResult = await _supabase.From<NegocioEntity>().Where(n => n.IdUsuario == userId).Limit(1).Get();
        var negocio = negocioResult.Models.FirstOrDefault();
        if (negocio == null) return NotFound();

        var analysisResult = await _supabase.From<AnalisisIaEntity>()
            .Where(a => a.NegocioId == negocio.Id)
            .Order("created_at", Postgrest.Constants.Ordering.Descending)
            .Limit(1)
            .Get();

        var latest = analysisResult.Models.FirstOrDefault();

        var reviewsResult = await _supabase.From<ReviewEntity>().Where(r => r.IdNegocio == negocio.Id).Get();
        var currentReviewCount = reviewsResult.Models.Count;

        if (latest == null)
            return Ok(new { analysis = (object?)null, currentReviewCount, analysisReviewCount = 0 });

        return Ok(new
        {
            analysis = new { latest.Brilla, latest.Quema, latest.Accion, latest.CreatedAt },
            currentReviewCount,
            analysisReviewCount = latest.ReviewCount
        });
    }

    // POST /api/review/analysis — genera análisis, aplica límites y guarda en BD
    [HttpPost("analysis")]
    public async Task<IActionResult> GenerateAnalysis()
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        var negocioResult = await _supabase.From<NegocioEntity>().Where(n => n.IdUsuario == userId).Limit(1).Get();
        var negocio = negocioResult.Models.FirstOrDefault();
        if (negocio == null) return NotFound();

        var reviewsResult = await _supabase.From<ReviewEntity>().Where(r => r.IdNegocio == negocio.Id).Get();
        var reviews = reviewsResult.Models;

        if (reviews.Count == 0)
            return Ok(new { brilla = "Aún no tienes reseñas para analizar.", quema = "—", accion = "Sincroniza tus reseñas de Google para empezar." });

        // Límite diario: hasta 3 análisis/día, +1 si hay 5+ reseñas nuevas desde el último
        var todayUtc = DateTimeOffset.UtcNow.Date;
        var allAnalysisResult = await _supabase.From<AnalisisIaEntity>()
            .Where(a => a.NegocioId == negocio.Id)
            .Order("created_at", Postgrest.Constants.Ordering.Descending)
            .Get();

        var todayCount = allAnalysisResult.Models.Count(a => a.CreatedAt.HasValue && a.CreatedAt.Value.UtcDateTime.Date == todayUtc);
        var lastAnalysis = allAnalysisResult.Models.FirstOrDefault();
        var reviewDelta = lastAnalysis != null ? reviews.Count - lastAnalysis.ReviewCount : reviews.Count;
        var dailyLimit = reviewDelta >= 5 ? 4 : 3;

        if (todayCount >= dailyLimit)
            return StatusCode(429, new { message = "Límite diario alcanzado. Se restablece mañana." });

        // Generar con IA
        var reviewSummary = string.Join("\n", reviews.Take(50).Select(r => $"[{r.StarRating}*] {r.ClienteReview}"));
        var prompt = $"Analiza estas resenas de un negocio espanol y responde SOLO con un JSON valido con este formato exacto: {{\"brilla\": \"frase corta sobre lo mejor\", \"quema\": \"frase corta sobre el problema principal\", \"accion\": \"accion concreta con metrica si puedes\"}}.\n\nResenas:\n{reviewSummary}";

        try
        {
            var response = await _aiService.GetClaudeMessageAsync(prompt, "");
            var start = response.IndexOf('{');
            var end = response.LastIndexOf('}');
            if (start < 0 || end <= start)
                return StatusCode(500, "Respuesta IA no válida");

            var json = response[start..(end + 1)];
            using var doc = System.Text.Json.JsonDocument.Parse(json);
            var root = doc.RootElement;
            var brilla = root.GetProperty("brilla").GetString() ?? "—";
            var quema  = root.GetProperty("quema").GetString()  ?? "—";
            var accion = root.GetProperty("accion").GetString() ?? "—";

            // Guardar en BD
            var entity = new AnalisisIaEntity
            {
                NegocioId   = negocio.Id,
                Brilla      = brilla,
                Quema       = quema,
                Accion      = accion,
                ReviewCount = reviews.Count,
                CreatedAt   = DateTimeOffset.UtcNow,
            };
            await _supabase.From<AnalisisIaEntity>().Insert(entity);

            return Ok(new { brilla, quema, accion });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[ReviewController] Error generating analysis");
            return StatusCode(500, "Error generando análisis");
        }
    }

    // Mantenemos el endpoint viejo para no romper llamadas existentes
    [HttpPost("summary")]
    public Task<IActionResult> GetSummary() => GenerateAnalysis();

    [HttpPut("{id}/estado")]
    public async Task<IActionResult> SetEstado(Guid id, [FromBody] SetEstadoRequest request)
    {
        if (request.Estado != "pendiente" && request.Estado != "respondida" && request.Estado != "ignorada")
            return BadRequest("Estado inválido");

        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        var negocioResult = await _supabase.From<NegocioEntity>()
            .Where(n => n.IdUsuario == userId).Limit(1).Get();
        var negocio = negocioResult.Models.FirstOrDefault();
        if (negocio == null) return NotFound("Negocio no encontrado");

        var reviewResult = await _supabase.From<ReviewEntity>()
            .Where(r => r.Id == id && r.IdNegocio == negocio.Id).Limit(1).Get();
        var review = reviewResult.Models.FirstOrDefault();
        if (review == null) return NotFound("Reseña no encontrada");

        review.Estado = request.Estado;
        await _supabase.From<ReviewEntity>().Where(r => r.Id == id).Update(review);
        return Ok(new { id, estado = request.Estado });
    }
}

public record SetEstadoRequest(string Estado);
