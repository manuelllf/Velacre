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
    private readonly IGoogleBusinessService _gbp;
    private readonly Supabase.Client _supabase;
    private readonly ILogger<ReviewController> _logger;

    public ReviewController(IReviewAiService aiService, IGoogleBusinessService gbp, Supabase.Client supabase, ILogger<ReviewController> logger)
    {
        _aiService = aiService;
        _gbp       = gbp;
        _supabase  = supabase;
        _logger    = logger;
    }

    [HttpPost("generate")]
    public async Task<IActionResult> GenerateResponse([FromBody] GenerateReviewRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.ReviewText))
            return BadRequest("La reseña no puede estar vacía.");

        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        _logger.LogInformation("[ReviewController] POST /generate — userId={UserId}", userId);

        var usuarioResult = await _supabase.From<UsuarioEntity>().Where(u => u.Id == userId).Limit(1).Get();
        var usuario = usuarioResult.Models.FirstOrDefault();

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
                    await _supabase.From<UsuarioEntity>().Where(u => u.Id == userId).Update(usuario);
                }
                if (usuario.RespuestasManualesMes >= manualLimit)
                {
                    _logger.LogWarning("[ReviewController] Usuario {UserId} alcanzó límite manual {Limit} plan={Plan}", userId, manualLimit, usuario.Plan);
                    return StatusCode(429, new { error = "limit_reached", plan = usuario.Plan, limit = manualLimit, used = manualLimit });
                }
            }
        }

        var negocioResult = await _supabase.From<NegocioEntity>().Where(n => n.IdUsuario == userId).Limit(1).Get();
        var negocio = negocioResult.Models.FirstOrDefault();
        if (negocio == null) return NotFound("No tienes ningún negocio registrado. Completa el onboarding primero.");

        try
        {
            var (profesional, cercano, directo, contextoCliente, contextoRespuesta, retenida, motivoRetencion) =
                await _aiService.GenerateThreeResponsesWithSafeFilterAsync(
                    request.ReviewText,
                    negocio.Descripcion ?? negocio.Nombre
                );

            if (retenida)
            {
                _logger.LogWarning("[ReviewController] Reseña manual retenida por seguridad — motivo={Motivo}", motivoRetencion);
                return Ok(new { retenida = true, motivoRetencion });
            }

            _logger.LogInformation("[ReviewController] Respuestas manuales generadas OK (sin guardar)");
            return Ok(new { retenida = false, motivoRetencion = (string?)null, contextoCliente, contextoRespuesta, profesional, cercano, directo });
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
        if (string.IsNullOrWhiteSpace(request.ReviewText))
            return BadRequest("La reseña no puede estar vacía.");

        var tonoLower = request.TonoSeleccionado.ToLower();
        if (tonoLower != "profesional" && tonoLower != "cercano" && tonoLower != "directo")
            return BadRequest("Tono inválido.");

        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        _logger.LogInformation("[ReviewController] POST /save-manual — userId={UserId}, tono={Tono}", userId, request.TonoSeleccionado);

        var usuarioResult = await _supabase.From<UsuarioEntity>().Where(u => u.Id == userId).Limit(1).Get();
        var usuario = usuarioResult.Models.FirstOrDefault();

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
                    await _supabase.From<UsuarioEntity>().Where(u => u.Id == userId).Update(usuario);
                }
                if (usuario.RespuestasManualesMes >= manualLimit)
                {
                    _logger.LogWarning("[ReviewController] Usuario {UserId} alcanzó límite manual {Limit} al guardar", userId, manualLimit);
                    return StatusCode(429, new { error = "limit_reached", plan = usuario.Plan, limit = manualLimit, used = manualLimit });
                }
            }
        }

        var negocioResult = await _supabase.From<NegocioEntity>().Where(n => n.IdUsuario == userId).Limit(1).Get();
        var negocio = negocioResult.Models.FirstOrDefault();
        if (negocio == null) return NotFound("No tienes ningún negocio registrado.");

        try
        {
            var estado = request.Estado == "respondida" ? "respondida" : "pendiente";
            var tonoCapitalized = char.ToUpper(tonoLower[0]) + tonoLower[1..];
            var now2 = DateTimeOffset.UtcNow;

            var entity = new ReviewEntity
            {
                Codigo = "BFK" + Guid.NewGuid().ToString("N")[..7].ToUpper(),
                IdNegocio = negocio.Id,
                ClienteReview = request.ReviewText,
                RespuestaProfesional = request.RespuestaProfesional,
                RespuestaCercano = request.RespuestaCercano,
                RespuestaDirecto = request.RespuestaDirecto,
                TonoGenerado = tonoCapitalized,
                Plataforma = "Otra",
                Estado = estado,
                ContextoCliente = request.ContextoCliente,
                ContextoRespuesta = request.ContextoRespuesta,
                RespondidaFecha = estado == "respondida" ? now2 : null,
                CreadoPor = userId,
                CreadoFecha = now2
            };

            var result = await _supabase.From<ReviewEntity>().Insert(entity);
            if (result.Models.Count == 0)
                return StatusCode(500, "No se pudo guardar la reseña.");

            var saved = result.Models[0];

            // Increment manual counter
            if (usuario != null)
            {
                var esProEfectivo2 = usuario.Plan == "pro" ||
                    (usuario.ProOverride && (!usuario.ProOverrideHasta.HasValue || usuario.ProOverrideHasta.Value > DateTimeOffset.UtcNow));
                if (!esProEfectivo2)
                {
                    usuario.RespuestasManualesMes += 1;
                    if (usuario.RespuestasMesReset == null) usuario.RespuestasMesReset = DateTimeOffset.UtcNow;
                    await _supabase.From<UsuarioEntity>().Where(u => u.Id == userId).Update(usuario);
                    _logger.LogDebug("[ReviewController] Contador manual → {Count} para userId={UserId}", usuario.RespuestasManualesMes, userId);
                }
            }

            _logger.LogInformation("[ReviewController] Review manual guardada: {ReviewId}", saved.Id);

            return Ok(new
            {
                id = saved.Id,
                googleReviewId = (string?)null,
                authorName = (string?)null,
                starRating = (int?)null,
                reviewDate = saved.CreadoFecha,
                clientereview = saved.ClienteReview,
                estado = saved.Estado,
                respuestaProfesional = saved.RespuestaProfesional,
                respuestaCercano = saved.RespuestaCercano,
                respuestaDirecto = saved.RespuestaDirecto,
                tonoGenerado = saved.TonoGenerado,
                plataforma = saved.Plataforma,
                respondidaFecha = saved.RespondidaFecha,
                contextoCliente = saved.ContextoCliente,
                contextoRespuesta = saved.ContextoRespuesta,
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

        // ── Plan limit check + reserva atómica ───────────────────────────────
        var usuarioRes = await _supabase.From<UsuarioEntity>().Where(u => u.Id == userId).Limit(1).Get();
        var usuario    = usuarioRes.Models.FirstOrDefault();
        var incrementedCounter = false;
        var softCapWarning = false;
        if (usuario != null)
        {
            var now = DateTimeOffset.UtcNow;
            var esProEfectivo = usuario.Plan == "pro" ||
                (usuario.ProOverride && (!usuario.ProOverrideHasta.HasValue || usuario.ProOverrideHasta.Value > now));

            // Límite por plan. Pro usa -1 (sin hard cap en la RPC) pero SÍ incrementa
            // el contador para que podamos detectar el cap soft (250 IA/mes) y avisar.
            //   Basic: 10/mes     Core: 20/mes     Pro: sin límite duro, warning a 250
            int iaLimit;
            if (esProEfectivo)               iaLimit = -1;
            else if (usuario.Plan == "core") iaLimit = 20;
            else                             iaLimit = 10;

            var preCount = usuario.RespuestasIaMes;

            // Incremento atómico vía RPC. Para Pro, el resultado de la RPC es informativo
            // (solo para el cap soft 250/mes) — NUNCA bloquea a un usuario Pro.
            bool allowed;
            try
            {
                var rpcResult = await _supabase.Rpc("try_increment_ia_counter",
                    new Dictionary<string, object> { { "p_user_id", userId }, { "p_limit", iaLimit } });
                var rpcContent = rpcResult?.Content?.Trim().Trim('"') ?? "";
                var rpcAllowed = rpcContent.Equals("true", StringComparison.OrdinalIgnoreCase);

                // Pro SIEMPRE pasa — la RPC solo sirve para incrementar el contador
                allowed = esProEfectivo || rpcAllowed;

                if (!rpcAllowed)
                {
                    _logger.LogWarning("[ReviewController] RPC returned false: userId={UserId} plan={Plan} iaLimit={Limit} rpcContent=\"{RpcContent}\" esProEfectivo={EsPro}",
                        userId, usuario.Plan, iaLimit, rpcContent, esProEfectivo);
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
            // Revertir incremento si la respuesta ya existía
            if (incrementedCounter)
                await _supabase.From<UsuarioEntity>().Where(u => u.Id == userId)
                    .Set(u => u.RespuestasIaMes, Math.Max(0, (usuario!.RespuestasIaMes)))
                    .Update();
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
                    var rpcRes = await _supabase.Rpc("get_top_keywords",
                        new Dictionary<string, object>
                        {
                            { "p_negocio_id", negocio.Id },
                            { "p_limit", 6 }
                        });
                    var rpcBody = rpcRes?.Content ?? "[]";
                    using var rpcDoc = System.Text.Json.JsonDocument.Parse(rpcBody);
                    topFallback = rpcDoc.RootElement.EnumerateArray()
                        .Select(e => e.TryGetProperty("word", out var w) ? w.GetString() ?? "" : "")
                        .Where(s => !string.IsNullOrWhiteSpace(s))
                        .ToArray();
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

                await _supabase.From<ReviewEntity>().Where(r => r.Id == review.Id).Update(review);

                // Revertir el slot de IA consumido (no se generó respuesta real)
                if (incrementedCounter && usuario != null)
                    await _supabase.From<UsuarioEntity>().Where(u => u.Id == userId)
                        .Set(u => u.RespuestasIaMes, Math.Max(0, usuario.RespuestasIaMes))
                        .Update();

                return Ok(new { retenida = true, motivoRetencion, response = (string?)null });
            }
            // ─────────────────────────────────────────────────────────────────

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
            review.ContextoCliente = contextoCliente;
            review.ContextoRespuesta = contextoRespuesta;
            review.ActualizadoPor = userId;
            review.ActualizadoFecha = DateTimeOffset.UtcNow;
            review.KeywordsUsadas = keywordsUsadas;

            await _supabase.From<ReviewEntity>()
                .Where(r => r.Id == review.Id)
                .Update(review);

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
                    await _supabase.From<UsuarioEntity>().Where(u => u.Id == userId)
                        .Set(u => u.RespuestasIaMes, Math.Max(0, usuario.RespuestasIaMes))
                        .Update();
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

        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        _logger.LogInformation("[ReviewController] POST /{ReviewId}/publish-google — userId={UserId}", id, userId);

        // Verificar plan Core/Pro
        var usuarioRes = await _supabase.From<UsuarioEntity>().Where(u => u.Id == userId).Limit(1).Get();
        var usuario    = usuarioRes.Models.FirstOrDefault();
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
        if (request.Estado == "respondida" && review.RespondidaFecha == null)
            review.RespondidaFecha = DateTimeOffset.UtcNow;
        else if (request.Estado != "respondida")
            review.RespondidaFecha = null;
        await _supabase.From<ReviewEntity>().Where(r => r.Id == id).Update(review);
        return Ok(new { id, estado = request.Estado });
    }
}

public record SetEstadoRequest(string Estado);
public record PublishGoogleRequest(string RespuestaEditada);
