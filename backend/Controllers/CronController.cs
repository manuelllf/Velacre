using Microsoft.AspNetCore.Mvc;
using backend.Interfaces;
using backend.Models.Entities;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CronController : ControllerBase
{
    private readonly INegocioRepository _negocioRepo;
    private readonly IReviewRepository _reviewRepo;
    private readonly IUsuarioRepository _usuarioRepo;
    private readonly IOutscraperService _outscraper;
    private readonly IReviewAiService _ai;
    private readonly ILogger<CronController> _logger;
    private readonly string _cronSecret;

    public CronController(
        INegocioRepository negocioRepo,
        IReviewRepository reviewRepo,
        IUsuarioRepository usuarioRepo,
        IOutscraperService outscraper,
        IReviewAiService ai,
        ILogger<CronController> logger)
    {
        _negocioRepo = negocioRepo;
        _reviewRepo = reviewRepo;
        _usuarioRepo = usuarioRepo;
        _outscraper = outscraper;
        _ai = ai;
        _logger = logger;
        _cronSecret = Environment.GetEnvironmentVariable("CRON_SECRET") ?? "";
    }

    [HttpPost("sync")]
    public async Task<IActionResult> SyncAll()
    {
        if (!string.IsNullOrEmpty(_cronSecret))
        {
            var provided = Request.Headers["X-Cron-Secret"].FirstOrDefault() ?? "";
            if (provided != _cronSecret)
            {
                _logger.LogWarning("[CronController] Petición rechazada: X-Cron-Secret inválido");
                return Unauthorized();
            }
        }

        _logger.LogInformation("[CronController] Iniciando sync semanal de reseñas");

        var negocios = await _negocioRepo.GetAllWithPlaceIdAsync();
        _logger.LogInformation("[CronController] {Count} negocios con place_id", negocios.Count);

        int totalNew = 0;
        int totalPreGen = 0;
        int synced = 0;
        var errors = new List<string>();

        // Cache dueños consultados (plan + auto_pre_gen_ia) para no hacer N GetById
        // si un usuario tiene varios negocios (multi-local).
        var ownerCache = new Dictionary<Guid, UsuarioEntity?>();

        foreach (var negocio in negocios)
        {
            try
            {
                var existing = await _reviewRepo.GetByNegocioIdAsync(negocio.Id);

                var existingIds = existing
                    .Where(r => r.GoogleReviewId != null)
                    .Select(r => r.GoogleReviewId!)
                    .ToHashSet();

                DateTimeOffset? sinceDate = null;
                if (existing.Count > 0)
                {
                    var latest = existing
                        .Where(r => r.GoogleReviewId != null && r.ReviewDate.HasValue)
                        .Select(r => r.ReviewDate!.Value)
                        .DefaultIfEmpty()
                        .Max();
                    if (latest != default) sinceDate = latest;
                }

                var reviews = await _outscraper.GetReviewsAsync(negocio.PlaceId!, sinceDate);
                var ownerId = negocio.IdUsuario ?? negocio.CreadoPor;
                int newCount = 0;
                int preGenCount = 0;

                // Pre-cargar datos del dueño una vez por batch (resolverá plan + flag)
                if (!ownerCache.TryGetValue(ownerId, out var owner))
                {
                    owner = await _usuarioRepo.GetByIdAsync(ownerId);
                    ownerCache[ownerId] = owner;
                }

                // ¿Elegible para pre-gen? Flag activo + plan distinto de basic.
                // Basic ignora siempre (cap 10 IA es barrera deliberada).
                var preGenEligible = owner != null
                    && owner.AutoPreGenIa
                    && owner.Plan != "basic";

                // Límite IA por plan — Core 25, Pro -1 (unlimited, solo usado para
                // incrementar el contador y detectar cap soft 250). Basic nunca llega.
                int iaLimit = owner?.Plan == "pro" ? -1 : 25;
                bool budgetExhausted = false;

                foreach (var review in reviews)
                {
                    if (existingIds.Contains(review.ReviewId)) continue;

                    var yaRespondida = !string.IsNullOrWhiteSpace(review.OwnerAnswer);
                    var entity = new ReviewEntity
                    {
                        Codigo         = "BFK" + Guid.NewGuid().ToString("N")[..7].ToUpper(),
                        IdNegocio      = negocio.Id,
                        GoogleReviewId = review.ReviewId,
                        AuthorName     = review.AuthorName,
                        StarRating     = review.StarRating,
                        ReviewDate     = review.PublishedAt,
                        ClienteReview  = review.Text,
                        ReviewLanguage = review.Language,
                        Estado         = yaRespondida ? "respondida" : "pendiente",
                        Respuesta      = yaRespondida ? review.OwnerAnswer : null,
                        TonoGenerado   = yaRespondida ? "google" : null,
                        CreadoPor            = ownerId,
                        CreadoFecha          = DateTimeOffset.UtcNow
                    };

                    await _reviewRepo.InsertAsync(entity);
                    newCount++;

                    // ── Pre-gen IA opt-in ──────────────────────────────────────
                    // Condiciones: flag activo, plan != basic, review nueva sin
                    // respuesta previa (no yaRespondida), y queda cupo (Core).
                    // Si el cupo Core se agota a mitad del batch, el resto del
                    // negocio queda como "pendiente" manual — no bloqueamos sync.
                    if (!preGenEligible || yaRespondida || budgetExhausted) continue;

                    try
                    {
                        // Incremento atómico del contador IA. Pro: RPC retorna
                        // siempre true (limit=-1). Core: respeta 25/mes.
                        var rpcAllowed = await _usuarioRepo.TryIncrementIaCounterAsync(ownerId, iaLimit);
                        var esProEfectivo = owner!.Plan == "pro";
                        var allowed = esProEfectivo || rpcAllowed;

                        if (!allowed)
                        {
                            _logger.LogInformation("[CronController] Pre-gen cupo agotado para userId={UserId} (plan={Plan}), resto del batch queda manual", ownerId, owner.Plan);
                            budgetExhausted = true;
                            continue;
                        }

                        var reviewContext = !string.IsNullOrWhiteSpace(entity.ClienteReview)
                            ? entity.ClienteReview
                            : entity.StarRating.HasValue
                                ? $"[Reseña sin texto] {entity.StarRating} estrella{(entity.StarRating != 1 ? "s" : "")} de {entity.AuthorName ?? "un cliente"}. No dejó comentario escrito."
                                : $"[Reseña sin texto] de {entity.AuthorName ?? "un cliente"}. No dejó comentario escrito.";

                        var lang = string.IsNullOrEmpty(entity.ReviewLanguage) ? "es" : entity.ReviewLanguage;
                        var tone = negocio.TonoPredefinido;
                        var keywords = negocio.PalabrasClave;
                        if (keywords == null || keywords.Length == 0)
                            keywords = new[] { negocio.Nombre };

                        var result = await _ai.GenerateSingleResponseWithContextAsync(
                            reviewContext,
                            negocio.Descripcion ?? negocio.Nombre,
                            tone,
                            lang,
                            keywords);

                        if (result.Retenida)
                        {
                            // Reseña grave retenida por filtro de seguridad: marcar como tal
                            // y revertir el slot de IA consumido (no se guarda respuesta real).
                            entity.Retenida = true;
                            entity.MotivoRetencion = result.MotivoRetencion;
                            await _reviewRepo.UpdateAsync(entity);
                            // Rollback del contador
                            var fresh = await _usuarioRepo.GetByIdAsync(ownerId);
                            if (fresh != null)
                                await _usuarioRepo.UpdateIaCounterRollbackAsync(ownerId, Math.Max(0, fresh.RespuestasIaMes - 1));
                            _logger.LogWarning("[CronController] Pre-gen retenida por seguridad review={ReviewId} motivo={Motivo}", entity.Id, result.MotivoRetencion);
                            continue;
                        }

                        entity.Respuesta = result.Response;
                        entity.TonoGenerado = tone;
                        entity.ContextoCliente = result.ContextoCliente;
                        entity.ContextoRespuesta = result.ContextoRespuesta;
                        entity.KeywordsUsadas = result.KeywordsUsadas;
                        entity.ActualizadoPor = ownerId;
                        entity.ActualizadoFecha = DateTimeOffset.UtcNow;
                        // Estado se mantiene "pendiente" — el dueño aún tiene que
                        // revisar y publicar. El pre-gen solo evita el latency de
                        // 4-6s al abrir el dashboard.
                        await _reviewRepo.UpdateAsync(entity);
                        preGenCount++;
                    }
                    catch (Exception aiEx)
                    {
                        // Fallo de IA no rompe el sync — la reseña queda pendiente
                        // como si el pre-gen no hubiera ocurrido. Rollback del slot.
                        _logger.LogWarning(aiEx, "[CronController] Pre-gen falló review={ReviewId}, queda pendiente", entity.Id);
                        try
                        {
                            var fresh = await _usuarioRepo.GetByIdAsync(ownerId);
                            if (fresh != null)
                                await _usuarioRepo.UpdateIaCounterRollbackAsync(ownerId, Math.Max(0, fresh.RespuestasIaMes - 1));
                        }
                        catch { /* rollback best-effort */ }
                    }
                }

                totalNew += newCount;
                totalPreGen += preGenCount;
                synced++;
                _logger.LogInformation("[CronController] Negocio {NegocioId}: {New} nuevas reseñas, {PreGen} pre-generadas", negocio.Id, newCount, preGenCount);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[CronController] Error sync negocio {NegocioId}", negocio.Id);
                errors.Add(negocio.Id.ToString());
            }
        }

        _logger.LogInformation("[CronController] Sync completado: {Synced}/{Total} negocios, {New} nuevas reseñas, {PreGen} pre-generadas, {Errors} errores",
            synced, negocios.Count, totalNew, totalPreGen, errors.Count);

        return Ok(new { synced, total = negocios.Count, totalNew, totalPreGen, errors });
    }
}
