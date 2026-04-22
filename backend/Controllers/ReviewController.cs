using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using backend.Infrastructure;
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
    private readonly IGoogleBusinessService _gbp;
    private readonly IUsuarioRepository _usuarioRepo;
    private readonly INegocioRepository _negocioRepo;
    private readonly IReviewRepository _reviewRepo;
    private readonly IAnalisisIaRepository _analisisIaRepo;
    private readonly ILogger<ReviewController> _logger;

    public ReviewController(
        IReviewAiService aiService,
        IGoogleBusinessService gbp,
        IUsuarioRepository usuarioRepo,
        INegocioRepository negocioRepo,
        IReviewRepository reviewRepo,
        IAnalisisIaRepository analisisIaRepo,
        ILogger<ReviewController> logger)
    {
        _aiService      = aiService;
        _gbp            = gbp;
        _usuarioRepo    = usuarioRepo;
        _negocioRepo    = negocioRepo;
        _reviewRepo     = reviewRepo;
        _analisisIaRepo = analisisIaRepo;
        _logger         = logger;
    }

    [HttpPost("generate")]
    public async Task<IActionResult> GenerateResponse([FromBody] GenerateReviewRequest request)
    {
        var userId = User.GetUserId();
        _logger.LogInformation("[ReviewController] POST /generate — userId={UserId}", userId);

        var usuario = await _usuarioRepo.GetByIdAsync(userId);

        if (usuario != null)
        {
            var now = DateTimeOffset.UtcNow;
            if (usuario.Estado == "baneado")
                return StatusCode(403, "Tu cuenta está suspendida. Contacta con soporte.");
            if (usuario.Estado == "prueba" && usuario.PruebaHasta.HasValue && usuario.PruebaHasta.Value < now)
                return StatusCode(403, "Tu período de prueba ha expirado. Contacta con soporte para activar tu cuenta.");

            var esProEfectivo = usuario.Plan == "pro" ||
                (usuario.ProOverride && (!usuario.ProOverrideHasta.HasValue || usuario.ProOverrideHasta.Value > now));

            if (!esProEfectivo)
            {
                int manualLimit = 5;
                if (usuario.RespuestasMesReset == null ||
                    usuario.RespuestasMesReset.Value.Year < now.Year ||
                    (usuario.RespuestasMesReset.Value.Year == now.Year && usuario.RespuestasMesReset.Value.Month < now.Month))
                {
                    usuario.RespuestasManualesMes = 0;
                    usuario.RespuestasMesReset = now;
                    await _usuarioRepo.UpdateAsync(usuario);
                }
                if (usuario.RespuestasManualesMes >= manualLimit)
                {
                    _logger.LogWarning("[ReviewController] Usuario {UserId} alcanzó límite manual {Limit} plan={Plan}", userId, manualLimit, usuario.Plan);
                    return StatusCode(429, new { error = "limit_reached", plan = usuario.Plan, limit = manualLimit, used = manualLimit });
                }
            }
        }

        var negocio = await _negocioRepo.ResolveScopedAsync(HttpContext, userId);
        if (negocio == null) return NotFound("No tienes ningún negocio registrado. Completa el onboarding primero.");

        var tone = request.Tono ?? negocio.TonoPredefinido ?? "Profesional";

        try
        {
            var (respuesta, contextoCliente, contextoRespuesta, _, retenida, motivoRetencion) =
                await _aiService.GenerateSingleResponseWithContextAsync(
                    request.ReviewText,
                    negocio.Descripcion ?? negocio.Nombre,
                    tone,
                    "es"
                );

            if (retenida)
            {
                _logger.LogWarning("[ReviewController] Reseña manual retenida por seguridad — motivo={Motivo}", motivoRetencion);
                return Ok(new { retenida = true, motivoRetencion });
            }

            _logger.LogInformation("[ReviewController] Respuesta manual generada OK (sin guardar)");
            return Ok(new { retenida = false, motivoRetencion = (string?)null, contextoCliente, contextoRespuesta, respuesta });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[ReviewController] Error al generar respuesta manual para userId={UserId}", userId);
            throw;
        }
    }

    [HttpPost("save-manual")]
    public async Task<IActionResult> SaveManualReview([FromBody] SaveManualReviewRequest request)
    {
        var userId = User.GetUserId();
        _logger.LogInformation("[ReviewController] POST /save-manual — userId={UserId}, tono={Tono}", userId, request.TonoSeleccionado);

        var usuario = await _usuarioRepo.GetByIdAsync(userId);

        if (usuario != null)
        {
            var now = DateTimeOffset.UtcNow;
            var esProEfectivo = usuario.Plan == "pro" ||
                (usuario.ProOverride && (!usuario.ProOverrideHasta.HasValue || usuario.ProOverrideHasta.Value > now));

            if (!esProEfectivo)
            {
                int manualLimit = 5;
                if (usuario.RespuestasMesReset == null ||
                    usuario.RespuestasMesReset.Value.Year < now.Year ||
                    (usuario.RespuestasMesReset.Value.Year == now.Year && usuario.RespuestasMesReset.Value.Month < now.Month))
                {
                    usuario.RespuestasManualesMes = 0;
                    usuario.RespuestasMesReset = now;
                    await _usuarioRepo.UpdateAsync(usuario);
                }
                if (usuario.RespuestasManualesMes >= manualLimit)
                {
                    _logger.LogWarning("[ReviewController] Usuario {UserId} alcanzó límite manual {Limit} al guardar", userId, manualLimit);
                    return StatusCode(429, new { error = "limit_reached", plan = usuario.Plan, limit = manualLimit, used = manualLimit });
                }
            }
        }

        var negocio = await _negocioRepo.ResolveScopedAsync(HttpContext, userId);
        if (negocio == null) return NotFound("No tienes ningún negocio registrado.");

        try
        {
            var estado = request.Estado == "respondida" ? "respondida" : "pendiente";
            var tonoLower = request.TonoSeleccionado.ToLower();
            var tonoCapitalized = char.ToUpper(tonoLower[0]) + tonoLower[1..];
            var now2 = DateTimeOffset.UtcNow;

            var entity = new ReviewEntity
            {
                Codigo = "BFK" + Guid.NewGuid().ToString("N")[..7].ToUpper(),
                IdNegocio = negocio.Id,
                ClienteReview = request.ReviewText,
                Respuesta = request.Respuesta,
                TonoGenerado = tonoCapitalized,
                Plataforma = "Otra",
                Estado = estado,
                ContextoCliente = request.ContextoCliente,
                ContextoRespuesta = request.ContextoRespuesta,
                RespondidaFecha = estado == "respondida" ? now2 : null,
                CreadoPor = userId,
                CreadoFecha = now2
            };

            await _reviewRepo.InsertAsync(entity);

            // Increment manual counter
            if (usuario != null)
            {
                var esProEfectivo2 = usuario.Plan == "pro" ||
                    (usuario.ProOverride && (!usuario.ProOverrideHasta.HasValue || usuario.ProOverrideHasta.Value > DateTimeOffset.UtcNow));
                if (!esProEfectivo2)
                {
                    usuario.RespuestasManualesMes += 1;
                    if (usuario.RespuestasMesReset == null) usuario.RespuestasMesReset = DateTimeOffset.UtcNow;
                    await _usuarioRepo.UpdateAsync(usuario);
                    _logger.LogDebug("[ReviewController] Contador manual → {Count} para userId={UserId}", usuario.RespuestasManualesMes, userId);
                }
            }

            _logger.LogInformation("[ReviewController] Review manual guardada: {ReviewId}", entity.Id);

            return Ok(new
            {
                id = entity.Id,
                googleReviewId = (string?)null,
                authorName = (string?)null,
                starRating = (int?)null,
                reviewDate = entity.CreadoFecha,
                clientereview = entity.ClienteReview,
                estado = entity.Estado,
                respuesta = entity.Respuesta,
                tonoGenerado = entity.TonoGenerado,
                plataforma = entity.Plataforma,
                respondidaFecha = entity.RespondidaFecha,
                contextoCliente = entity.ContextoCliente,
                contextoRespuesta = entity.ContextoRespuesta,
                retenida = false,
                motivoRetencion = (string?)null,
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[ReviewController] Error al guardar review manual para userId={UserId}", userId);
            throw;
        }
    }

    [HttpGet("pending")]
    public async Task<IActionResult> GetPendingReviews()
    {
        var userId = User.GetUserId();
        _logger.LogInformation("[ReviewController] GET /pending — userId={UserId}", userId);

        var negocio = await _negocioRepo.ResolveScopedAsync(HttpContext, userId);

        if (negocio == null)
        {
            _logger.LogWarning("[ReviewController] userId={UserId} no tiene negocio registrado", userId);
            return NotFound("No tienes ningún negocio registrado. Completa el onboarding primero.");
        }

        var reviews = await _reviewRepo.GetByNegocioIdAsync(negocio.Id);

        var pending = reviews
            .Where(r => r.Respuesta == null)
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
                respuesta = r.Respuesta,
                tonoGenerado = r.TonoGenerado
            })
            .ToList();

        _logger.LogInformation("[ReviewController] GET /pending ← {Count} reseñas pendientes para negocioId={NegocioId}", pending.Count, negocio.Id);
        return Ok(pending);
    }

    [HttpPost("{id}/generate")]
    public async Task<IActionResult> GenerateForReview(Guid id, [FromQuery] bool force = false)
    {
        var userId = User.GetUserId();
        _logger.LogInformation("[ReviewController] POST /{ReviewId}/generate — userId={UserId} force={Force}", id, userId, force);

        var negocio = await _negocioRepo.ResolveScopedAsync(HttpContext, userId);

        if (negocio == null)
        {
            _logger.LogWarning("[ReviewController] userId={UserId} no tiene negocio registrado", userId);
            return NotFound("No tienes ningún negocio registrado. Completa el onboarding primero.");
        }

        var review = await _reviewRepo.GetByIdAndNegocioAsync(id, negocio.Id);

        if (review == null)
        {
            _logger.LogWarning("[ReviewController] Reseña {ReviewId} no encontrada para negocioId={NegocioId}", id, negocio.Id);
            return NotFound("Reseña no encontrada.");
        }

        // ── Plan limit check + reserva atómica ───────────────────────────────
        var usuario = await _usuarioRepo.GetByIdAsync(userId);
        var incrementedCounter = false;
        var softCapWarning = false;
        if (usuario != null)
        {
            var now = DateTimeOffset.UtcNow;
            var esProEfectivo = usuario.Plan == "pro" ||
                (usuario.ProOverride && (!usuario.ProOverrideHasta.HasValue || usuario.ProOverrideHasta.Value > now));

            // Límite por plan. Pro usa -1 (sin hard cap en la RPC) pero SÍ incrementa
            // el contador para que podamos detectar el cap soft (250 IA/mes) y avisar.
            //   Basic: 10/mes     Core: 25/mes     Pro: sin límite duro, warning a 250
            int iaLimit;
            if (esProEfectivo)               iaLimit = -1;
            else if (usuario.Plan == "core") iaLimit = 25;
            else                             iaLimit = 10;

            var preCount = usuario.RespuestasIaMes;

            // Incremento atómico vía RPC. Para Pro, el resultado de la RPC es informativo
            // (solo para el cap soft 250/mes) — NUNCA bloquea a un usuario Pro.
            bool allowed;
            try
            {
                var rpcAllowed = await _usuarioRepo.TryIncrementIaCounterAsync(userId, iaLimit);

                // Pro SIEMPRE pasa — la RPC solo sirve para incrementar el contador
                allowed = esProEfectivo || rpcAllowed;

                if (!rpcAllowed)
                {
                    _logger.LogWarning("[ReviewController] RPC returned false: userId={UserId} plan={Plan} iaLimit={Limit} esProEfectivo={EsPro}",
                        userId, usuario.Plan, iaLimit, esProEfectivo);
                }
            }
            catch (Exception rpcEx)
            {
                _logger.LogWarning(rpcEx, "[ReviewController] RPC try_increment_ia_counter falló para userId={UserId} plan={Plan}", userId, usuario.Plan);
                // Si la RPC falla: Pro sigue, non-Pro se bloquea por seguridad.
                allowed = esProEfectivo;
            }

            if (!allowed)
            {
                return StatusCode(429, new { error = "limit_reached", plan = usuario.Plan, limit = iaLimit, used = iaLimit });
            }
            incrementedCounter = true;

            // Cap soft Pro: cuando un usuario Pro supera 250 IA/mes, devolvemos un flag
            // para que el frontend muestre un aviso cordial (no bloqueamos).
            if (esProEfectivo && preCount + 1 >= 250)
            {
                softCapWarning = true;
                _logger.LogInformation("[ReviewController] Pro soft cap: userId={UserId} count={Count}", userId, preCount + 1);
            }
        }
        // ─────────────────────────────────────────────────────────────────────

        var tone = negocio.TonoPredefinido;
        var toneLower = tone.ToLower();

        var alreadyGenerated = review.Respuesta;
        var savedToneLower = review.TonoGenerado?.ToLower();
        var toneMatches = !string.IsNullOrEmpty(savedToneLower) && savedToneLower == toneLower;

        // Short-circuit: ya hay respuesta Y es del tono actual → devolver existente sin consumir IA.
        // Si el tono guardado NO coincide con el del negocio (p.ej. el dueño cambió el tono en Settings
        // desde la última generación), regeneramos con el nuevo tono aunque no haya force.
        // Con force=true siempre regenera, incluso si coinciden (el usuario pide respuesta nueva).
        if (!force && !string.IsNullOrEmpty(alreadyGenerated) && toneMatches)
        {
            _logger.LogInformation("[ReviewController] Tono {Tone} ya generado para reviewId={ReviewId}, devolviendo existente", tone, id);
            if (incrementedCounter)
                await _usuarioRepo.UpdateIaCounterRollbackAsync(userId, Math.Max(0, usuario!.RespuestasIaMes));
            return Ok(new { response = alreadyGenerated, tono = tone });
        }

        if (!string.IsNullOrEmpty(alreadyGenerated))
        {
            var motivo = force ? "force=true" : $"tono cambió ({savedToneLower ?? "sin_tono"} → {toneLower})";
            _logger.LogInformation("[ReviewController] Regenerando respuesta reviewId={ReviewId} motivo={Motivo}", id, motivo);
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

            // Fallback de keywords: si el negocio no tiene configuradas, usar las más usadas por la IA.
            // Antes se cargaban TODAS las reseñas del negocio en memoria para agrupar en .NET (N+1 + spike
            // de memoria para negocios con muchas reseñas). Ahora se delega a una RPC Postgres que hace
            // el GROUP BY con LATERAL unnest server-side y devuelve solo las 6 top keywords.
            var keywords = negocio.PalabrasClave;
            if (keywords == null || keywords.Length == 0)
            {
                string[] topFallback;
                try
                {
                    topFallback = await _reviewRepo.GetTopKeywordsAsync(negocio.Id, 6);
                }
                catch (Exception rpcEx)
                {
                    _logger.LogWarning(rpcEx, "[ReviewController] get_top_keywords RPC falló, usando nombre del negocio");
                    topFallback = Array.Empty<string>();
                }

                keywords = topFallback.Length > 0
                    ? topFallback
                    : new[] { negocio.Nombre };
            }

            var result = await _aiService.GenerateSingleResponseWithContextAsync(
                reviewContext,
                negocio.Descripcion ?? negocio.Nombre,
                tone,
                lang,
                keywords
            );
            var generated         = result.Response;
            var contextoCliente   = result.ContextoCliente;
            var contextoRespuesta = result.ContextoRespuesta;
            var keywordsUsadas    = result.KeywordsUsadas;
            var retenida          = result.Retenida;
            var motivoRetencion   = result.MotivoRetencion;

            // ── Reseña retenida por seguridad ─────────────────────────────────
            if (retenida)
            {
                _logger.LogWarning("[ReviewController] Reseña {ReviewId} retenida por seguridad — motivo={Motivo}", id, motivoRetencion);

                review.Retenida         = true;
                review.MotivoRetencion  = motivoRetencion;
                review.ActualizadoPor   = userId;
                review.ActualizadoFecha = DateTimeOffset.UtcNow;

                await _reviewRepo.UpdateAsync(review);

                // Revertir el slot de IA consumido (no se generó respuesta real)
                if (incrementedCounter && usuario != null)
                    await _usuarioRepo.UpdateIaCounterRollbackAsync(userId, Math.Max(0, usuario.RespuestasIaMes));

                return Ok(new { retenida = true, motivoRetencion, response = (string?)null });
            }
            // ─────────────────────────────────────────────────────────────────

            review.Respuesta = generated;
            review.TonoGenerado = tone;
            review.ContextoCliente = contextoCliente;
            review.ContextoRespuesta = contextoRespuesta;
            review.ActualizadoPor = userId;
            review.ActualizadoFecha = DateTimeOffset.UtcNow;
            review.KeywordsUsadas = keywordsUsadas;

            // Nota: NO cambiamos review.Estado tras regenerar. "Regenerar con IA" es una acción
            // de reemplazo de texto, no de reapertura — la reseña sigue donde estaba (respondida,
            // pendiente, lo que fuera). El textarea muestra el texto nuevo y el usuario decide.
            await _reviewRepo.UpdateAsync(review);

            _logger.LogInformation("[ReviewController] Respuesta generada y guardada para reviewId={ReviewId}", id);

            return Ok(new
            {
                response          = generated,
                tono              = tone,
                contextoCliente   = contextoCliente,
                contextoRespuesta = contextoRespuesta,
                keywordsUsadas    = keywordsUsadas,
                retenida          = false,
                softCapWarning    = softCapWarning
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[ReviewController] Error generando respuesta para reviewId={ReviewId}", id);

            // Rollback the reserved slot on AI failure
            if (incrementedCounter && usuario != null)
            {
                try
                {
                    await _usuarioRepo.UpdateIaCounterRollbackAsync(userId, Math.Max(0, usuario.RespuestasIaMes));
                }
                catch (Exception rollbackEx)
                {
                    _logger.LogError(rollbackEx, "[ReviewController] Error al revertir contador IA para userId={UserId}", userId);
                }
            }

            throw;
        }
    }

    [HttpGet("all")]
    public async Task<IActionResult> GetAllReviews()
    {
        var userId = User.GetUserId();

        var negocio = await _negocioRepo.ResolveScopedAsync(HttpContext, userId);
        if (negocio == null) return NotFound();

        var reviews = await _reviewRepo.GetByNegocioIdAsync(negocio.Id);

        var all = reviews
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
                respuesta = r.Respuesta,
                tonoGenerado = r.TonoGenerado,
                plataforma = r.Plataforma,
                keywordsUsadas = r.KeywordsUsadas ?? Array.Empty<string>(),
                actualizadoFecha   = r.ActualizadoFecha,
                respondidaFecha    = r.RespondidaFecha,
                contextoCliente    = r.ContextoCliente,
                contextoRespuesta  = r.ContextoRespuesta,
                respuestaPublicada = r.RespuestaPublicada,
                publicadaEnGoogle  = r.PublicadaEnGoogle,
                publicadaFecha     = r.PublicadaFecha,
                retenida           = r.Retenida,
                motivoRetencion    = r.MotivoRetencion,
            })
            .ToList();

        return Ok(all);
    }

    [HttpPost("{id}/translate")]
    public async Task<IActionResult> TranslateReview(Guid id)
    {
        var userId = User.GetUserId();

        var negocio = await _negocioRepo.ResolveScopedAsync(HttpContext, userId);
        if (negocio == null) return NotFound();

        var review = await _reviewRepo.GetByIdAndNegocioAsync(id, negocio.Id);
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
        var userId = User.GetUserId();

        var negocio = await _negocioRepo.ResolveScopedAsync(HttpContext, userId);
        if (negocio == null) return NotFound();

        var review = await _reviewRepo.GetByIdAndNegocioAsync(id, negocio.Id);
        if (review == null) return NotFound("Reseña no encontrada.");

        var responseText = review.Respuesta;
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
        var userId = User.GetUserId();
        var negocio = await _negocioRepo.ResolveScopedAsync(HttpContext, userId);
        if (negocio == null) return NotFound();

        var reviews = await _reviewRepo.GetByNegocioIdAsync(negocio.Id);

        var total = reviews.Count;
        var velacreCount = reviews.Count(r => r.TonoGenerado != null && r.TonoGenerado != "google");
        // Ahorro real: 4 min manual − 15 seg IA = 3,75 min por reseña
        var timeSavedMinutes = (int)Math.Round(velacreCount * 3.75);

        // Tasa de respuesta: histórico (antes de los últimos 3 meses) vs reciente
        var cutoff = DateTimeOffset.UtcNow.AddMonths(-3);
        var recent = reviews.Where(r => r.ReviewDate >= cutoff).ToList();
        var historic = reviews.Where(r => r.ReviewDate < cutoff).ToList();

        double currentRate = recent.Count > 0
            ? (double)recent.Count(r => r.TonoGenerado != null) / recent.Count * 100 : 0;
        double historicRate = historic.Count > 0
            ? (double)historic.Count(r => r.TonoGenerado != null) / historic.Count * 100 : 0;

        // Top keywords usadas por la IA en las respuestas generadas
        var keywordFreq = reviews
            .Where(r => r.KeywordsUsadas != null)
            .SelectMany(r => r.KeywordsUsadas!)
            .GroupBy(k => k, StringComparer.OrdinalIgnoreCase)
            .OrderByDescending(g => g.Count())
            .Take(6)
            .Select(g => new { word = g.Key, count = g.Count() })
            .ToList();

        var responseRate = total > 0 ? Math.Round((double)reviews.Count(r => r.TonoGenerado != null) / total * 100, 1) : 0;

        return Ok(new
        {
            total,
            velacreCount,
            timeSavedMinutes,
            responseRate,
            currentResponseRate = Math.Round(currentRate, 1),
            historicResponseRate = Math.Round(historicRate, 1),
            improvement = Math.Round(currentRate - historicRate, 1),
            topKeywordsUsadas = keywordFreq
        });
    }

    // GET /api/review/analysis — carga el análisis más reciente de BD si existe
    [HttpGet("analysis")]
    public async Task<IActionResult> GetAnalysis()
    {
        var userId = User.GetUserId();
        var negocio = await _negocioRepo.ResolveScopedAsync(HttpContext, userId);
        if (negocio == null) return NotFound();

        var latest = await _analisisIaRepo.GetLatestByNegocioIdAsync(negocio.Id);

        var reviews = await _reviewRepo.GetByNegocioIdAsync(negocio.Id);
        var currentReviewCount = reviews.Count;

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
        var userId = User.GetUserId();
        var negocio = await _negocioRepo.ResolveScopedAsync(HttpContext, userId);
        if (negocio == null) return NotFound();

        var reviews = await _reviewRepo.GetByNegocioIdAsync(negocio.Id);

        if (reviews.Count == 0)
            return Ok(new { brilla = "Aún no tienes reseñas para analizar.", quema = "—", accion = "Sincroniza tus reseñas de Google para empezar." });

        // Límite diario: 1 análisis/día
        var todayUtc = DateTimeOffset.UtcNow.Date;
        var allAnalysis = await _analisisIaRepo.GetAllByNegocioIdAsync(negocio.Id);

        var todayCount = allAnalysis.Count(a => a.CreatedAt.HasValue && a.CreatedAt.Value.UtcDateTime.Date == todayUtc);

        if (todayCount >= 1)
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
            await _analisisIaRepo.InsertAsync(entity);

            return Ok(new { brilla, quema, accion });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[ReviewController] Error generating analysis");
            return StatusCode(500, "Error generando análisis");
        }
    }

    // ─── POST /api/review/{id}/publish-google ────────────────────────────────

    /// <summary>
    /// Publica la respuesta editada directamente en Google Business Profile.
    /// Solo Core/Pro. La reseña debe tener google_review_id y el negocio debe tener GBP conectado.
    /// </summary>
    [HttpPost("{id}/publish-google")]
    public async Task<IActionResult> PublishToGoogle(Guid id, [FromBody] PublishGoogleRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.RespuestaEditada))
            return BadRequest("La respuesta no puede estar vacía.");

        var userId = User.GetUserId();
        _logger.LogInformation("[ReviewController] POST /{ReviewId}/publish-google — userId={UserId}", id, userId);

        // Verificar plan Core/Pro
        var usuario = await _usuarioRepo.GetByIdAsync(userId);
        if (usuario == null) return NotFound("Usuario no encontrado");

        var now = DateTimeOffset.UtcNow;
        var esProEfectivo = usuario.Plan == "pro" ||
            (usuario.ProOverride && (!usuario.ProOverrideHasta.HasValue || usuario.ProOverrideHasta.Value > now));
        var puedePublicar = esProEfectivo || usuario.Plan == "core";

        if (!puedePublicar)
        {
            _logger.LogWarning("[ReviewController] Usuario {UserId} plan={Plan} intentó publicar en Google (requiere Core/Pro)", userId, usuario.Plan);
            return StatusCode(403, new { error = "plan_required", requiredPlan = "core" });
        }

        var (ok, error) = await _gbp.PublishReplyAsync(id, userId, request.RespuestaEditada);

        if (!ok)
        {
            _logger.LogWarning("[ReviewController] Fallo al publicar en Google reviewId={Id}: {Error}", id, error);
            return error switch
            {
                "review_not_found"    => NotFound("Reseña no encontrada."),
                "no_google_review_id" => BadRequest("Esta reseña no proviene de Google y no puede publicarse."),
                "gbp_not_connected"   => StatusCode(400, new { error = "gbp_not_connected" }),
                "token_refresh_failed"=> StatusCode(502, "No se pudo renovar la conexión con Google. Reconecta tu cuenta en Configuración."),
                _                     => StatusCode(502, $"Error de Google API: {error}")
            };
        }

        _logger.LogInformation("[ReviewController] Respuesta publicada en Google para reviewId={Id}", id);
        return Ok(new { ok = true, reviewId = id });
    }

    // Mantenemos el endpoint viejo para no romper llamadas existentes
    [HttpPost("summary")]
    public Task<IActionResult> GetSummary() => GenerateAnalysis();

    [HttpPut("{id}/estado")]
    public async Task<IActionResult> SetEstado(Guid id, [FromBody] SetEstadoRequest request)
    {
        if (request.Estado != "pendiente" && request.Estado != "respondida" && request.Estado != "ignorada")
            return BadRequest("Estado inválido");

        var userId = User.GetUserId();
        var negocio = await _negocioRepo.ResolveScopedAsync(HttpContext, userId);
        if (negocio == null) return NotFound("Negocio no encontrado");

        var review = await _reviewRepo.GetByIdAndNegocioAsync(id, negocio.Id);
        if (review == null) return NotFound("Reseña no encontrada");

        review.Estado = request.Estado;
        if (request.Estado == "respondida" && review.RespondidaFecha == null)
            review.RespondidaFecha = DateTimeOffset.UtcNow;
        else if (request.Estado != "respondida")
            review.RespondidaFecha = null;
        await _reviewRepo.UpdateAsync(review);
        return Ok(new { id, estado = request.Estado });
    }

    /// <summary>
    /// Actualiza el texto de la respuesta generada por IA (o manual) de una reseña.
    /// Escribe sobre el campo respuestaX correspondiente al tono_generado actual.
    /// No permite editar respuestas 'google' (esas viven en GBP, nuestro edit no las alcanzaría).
    /// </summary>
    [HttpPut("{id}/response")]
    public async Task<IActionResult> UpdateResponse(Guid id, [FromBody] UpdateResponseRequest request)
    {
        var texto = request.Texto?.Trim() ?? string.Empty;
        if (texto.Length == 0)
            return BadRequest(new { error = "texto_vacio", mensaje = "La respuesta no puede estar vacía." });
        if (texto.Length > 2000)
            return BadRequest(new { error = "texto_largo", mensaje = "La respuesta supera el máximo permitido (2000 caracteres)." });

        var userId = User.GetUserId();
        var negocio = await _negocioRepo.ResolveScopedAsync(HttpContext, userId);
        if (negocio == null) return NotFound("Negocio no encontrado");

        var review = await _reviewRepo.GetByIdAndNegocioAsync(id, negocio.Id);
        if (review == null) return NotFound("Reseña no encontrada");

        var tono = review.TonoGenerado;
        if (string.IsNullOrEmpty(tono))
            return BadRequest(new { error = "sin_tono", mensaje = "No hay respuesta previa que editar en esta reseña." });
        if (string.Equals(tono, "google", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { error = "respuesta_google", mensaje = "No se pueden editar las respuestas ya publicadas directamente en Google." });

        review.Respuesta        = texto;
        review.ActualizadoPor   = userId;
        review.ActualizadoFecha = DateTimeOffset.UtcNow;

        await _reviewRepo.UpdateAsync(review);

        _logger.LogInformation("[ReviewController] Respuesta editada manualmente para reviewId={ReviewId} tono={Tono} len={Len}", id, tono, texto.Length);
        return Ok(new { id, tono, texto });
    }
}

public record SetEstadoRequest(string Estado);
public record UpdateResponseRequest(string Texto);
public record PublishGoogleRequest(string RespuestaEditada);
