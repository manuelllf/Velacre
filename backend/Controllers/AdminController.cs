using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using backend.Interfaces;
using backend.Models.Entities;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AdminController : ControllerBase
{
    private readonly Supabase.Client _supabase;
    private readonly ILogger<AdminController> _logger;
    private readonly IOutscraperService _outscraper;
    private readonly IReviewAiService _aiService;
    private readonly Guid _adminUserId;

    public AdminController(
        Supabase.Client supabase,
        ILogger<AdminController> logger,
        IOutscraperService outscraper,
        IReviewAiService aiService)
    {
        _supabase = supabase;
        _logger = logger;
        _outscraper = outscraper;
        _aiService = aiService;
        _adminUserId = Guid.Parse(Environment.GetEnvironmentVariable("ADMIN_USER_ID") ?? "00000000-0000-0000-0000-000000000000");
    }

    private async Task<bool> IsAdminAsync()
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        if (userId == _adminUserId) return true;
        var r = await _supabase.From<UsuarioEntity>().Where(u => u.Id == userId).Limit(1).Get();
        return r.Models.FirstOrDefault()?.Rol == "admin";
    }

    // ─── Usuarios ────────────────────────────────────────────────────────────

    [HttpGet("usuarios")]
    public async Task<IActionResult> GetUsuarios()
    {
        if (!await IsAdminAsync()) return Forbid();

        var usuariosResult = await _supabase.From<UsuarioEntity>().Get();
        var negociosResult = await _supabase.From<NegocioEntity>().Get();

        var negocios = negociosResult.Models
            .Where(n => n.IdUsuario.HasValue)
            .GroupBy(n => n.IdUsuario!.Value)
            .ToDictionary(g => g.Key, g => g.First());

        var now = DateTimeOffset.UtcNow;

        var data = usuariosResult.Models
            .OrderBy(u => u.CreadoFecha)
            .Select(u =>
            {
                var estadoEfectivo = u.Estado;
                if (u.Estado == "prueba" && u.PruebaHasta.HasValue && u.PruebaHasta.Value < now)
                    estadoEfectivo = "prueba_expirada";

                var proEfectivo = u.Plan == "pro" ||
                    (u.ProOverride && (!u.ProOverrideHasta.HasValue || u.ProOverrideHasta.Value > now));

                return new
                {
                    id               = u.Id,
                    nombre           = u.Nombre,
                    email            = u.Email,
                    activo           = u.Activo,
                    activoDesde      = u.ActivoDesde,
                    creadoFecha      = u.CreadoFecha,
                    plan             = u.Plan,
                    estado           = estadoEfectivo,
                    pruebaHasta      = u.PruebaHasta,
                    proOverride      = u.ProOverride,
                    proOverrideHasta = u.ProOverrideHasta,
                    proEfectivo,
                    notasAdmin       = u.NotasAdmin,
                    rol              = u.Rol,
                    negocio = negocios.TryGetValue(u.Id, out var n)
                        ? (object)new { id = n.Id, nombre = n.Nombre, placeId = n.PlaceId }
                        : null,
                };
            });

        return Ok(data);
    }

    // ─── Cambiar estado ───────────────────────────────────────────────────────

    [HttpPost("usuarios/{id}/estado")]
    public async Task<IActionResult> CambiarEstado(Guid id, [FromBody] CambiarEstadoRequest request)
    {
        if (!await IsAdminAsync()) return Forbid();
        if (request.Estado != "activo" && request.Estado != "baneado" && request.Estado != "prueba")
            return BadRequest("Estado inválido. Valores: activo, baneado, prueba");

        var result = await _supabase.From<UsuarioEntity>().Where(u => u.Id == id).Limit(1).Get();
        var usuario = result.Models.FirstOrDefault();
        if (usuario == null) return NotFound();

        var now = DateTimeOffset.UtcNow;
        var activo = request.Estado == "activo";
        var activoDesde = (usuario.ActivoDesde == null && (request.Estado == "activo" || request.Estado == "prueba"))
            ? now : usuario.ActivoDesde;
        var pruebaHasta = request.Estado == "prueba"
            ? now.AddDays(request.DiasPrueba ?? 14) : usuario.PruebaHasta;

        await _supabase.From<UsuarioEntity>()
            .Where(u => u.Id == id)
            .Set(u => u.Estado, request.Estado)
            .Set(u => u.Activo, activo)
            .Set(u => u.ActivoDesde, activoDesde)
            .Set(u => u.PruebaHasta, pruebaHasta)
            .Update();
        _logger.LogInformation("[AdminController] Usuario {UserId} estado → {Estado}", id, request.Estado);
        return Ok(new { estado = request.Estado, pruebaHasta });
    }

    // ─── Pro Override ─────────────────────────────────────────────────────────

    [HttpPost("usuarios/{id}/pro-override")]
    public async Task<IActionResult> ProOverride(Guid id, [FromBody] ProOverrideRequest request)
    {
        if (!await IsAdminAsync()) return Forbid();

        var result = await _supabase.From<UsuarioEntity>().Where(u => u.Id == id).Limit(1).Get();
        var usuario = result.Models.FirstOrDefault();
        if (usuario == null) return NotFound();

        var proOverrideHasta = request.Activo && request.DiasExpira.HasValue
            ? DateTimeOffset.UtcNow.AddDays(request.DiasExpira.Value)
            : (DateTimeOffset?)null;

        await _supabase.From<UsuarioEntity>()
            .Where(u => u.Id == id)
            .Set(u => u.ProOverride, request.Activo)
            .Set(u => u.ProOverrideHasta, proOverrideHasta)
            .Update();
        _logger.LogInformation("[AdminController] Usuario {UserId} ProOverride={Override}", id, request.Activo);
        return Ok(new { proOverride = request.Activo, proOverrideHasta });
    }

    // ─── Notas admin ──────────────────────────────────────────────────────────

    [HttpPut("usuarios/{id}/notas")]
    public async Task<IActionResult> ActualizarNotas(Guid id, [FromBody] NotasAdminRequest request)
    {
        if (!await IsAdminAsync()) return Forbid();

        var result = await _supabase.From<UsuarioEntity>().Where(u => u.Id == id).Limit(1).Get();
        var usuario = result.Models.FirstOrDefault();
        if (usuario == null) return NotFound();

        await _supabase.From<UsuarioEntity>()
            .Where(u => u.Id == id)
            .Set(u => u.NotasAdmin, request.Notas)
            .Update();
        return Ok();
    }

    // ─── Plan ─────────────────────────────────────────────────────────────────

    [HttpPost("usuarios/{id}/plan")]
    public async Task<IActionResult> CambiarPlan(Guid id, [FromBody] CambiarPlanRequest request)
    {
        if (!await IsAdminAsync()) return Forbid();
        if (request.Plan != "basic" && request.Plan != "core" && request.Plan != "pro")
            return BadRequest("Plan inválido. Valores: basic, core, pro");

        var result = await _supabase.From<UsuarioEntity>().Where(u => u.Id == id).Limit(1).Get();
        if (result.Models.FirstOrDefault() == null) return NotFound();

        await _supabase.From<UsuarioEntity>()
            .Where(u => u.Id == id)
            .Set(u => u.Plan, request.Plan)
            .Update();
        _logger.LogInformation("[AdminController] Usuario {UserId} plan → {Plan}", id, request.Plan);
        return Ok();
    }

    // ─── Place ID ─────────────────────────────────────────────────────────────

    [HttpPut("negocios/{negocioId}/place")]
    public async Task<IActionResult> SetPlaceId(Guid negocioId, [FromBody] SetPlaceIdRequest request)
    {
        if (!await IsAdminAsync()) return Forbid();
        if (string.IsNullOrWhiteSpace(request.PlaceId)) return BadRequest("place_id no puede estar vacío.");

        try
        {
            var result = await _supabase.From<NegocioEntity>().Where(n => n.Id == negocioId).Limit(1).Get();
            var negocio = result.Models.FirstOrDefault();
            if (negocio == null) return NotFound($"Negocio {negocioId} no encontrado");

            var old = negocio.PlaceId;
            negocio.PlaceId = request.PlaceId;
            negocio.ActualizadoFecha = DateTimeOffset.UtcNow;
            await _supabase.From<NegocioEntity>().Update(negocio);

            _logger.LogInformation("[AdminController] SetPlaceId: negocio {NegocioId} {Old} → {New}", negocioId, old, request.PlaceId);
            return Ok(new { negocioId, old, placeId = request.PlaceId });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AdminController] SetPlaceId error negocio {NegocioId}", negocioId);
            return StatusCode(500, ex.Message);
        }
    }

    // ─── Legacy compat ────────────────────────────────────────────────────────

    [HttpPost("usuarios/{id}/activar")]
    public async Task<IActionResult> Activar(Guid id)
    {
        if (!await IsAdminAsync()) return Forbid();
        return await CambiarEstado(id, new CambiarEstadoRequest("activo", null));
    }

    [HttpPost("usuarios/{id}/desactivar")]
    public async Task<IActionResult> Desactivar(Guid id)
    {
        if (!await IsAdminAsync()) return Forbid();
        return await CambiarEstado(id, new CambiarEstadoRequest("baneado", null));
    }

    // ─── Asignar Rol ──────────────────────────────────────────────────────────

    [HttpPut("usuarios/{id}/rol")]
    public async Task<IActionResult> AsignarRol(Guid id, [FromBody] AsignarRolRequest request)
    {
        if (!await IsAdminAsync()) return Forbid();
        if (request.Rol != "cliente" && request.Rol != "admin")
            return BadRequest("Rol inválido. Valores: cliente, admin");

        var result = await _supabase.From<UsuarioEntity>().Where(u => u.Id == id).Limit(1).Get();
        var usuario = result.Models.FirstOrDefault();
        if (usuario == null) return NotFound();

        await _supabase.From<UsuarioEntity>()
            .Where(u => u.Id == id)
            .Set(u => u.Rol, request.Rol)
            .Update();
        _logger.LogInformation("[AdminController] Usuario {UserId} rol → {Rol}", id, request.Rol);
        return Ok(new { rol = request.Rol });
    }

    // ─── Mini Radar (prospección) ─────────────────────────────────────────────
    // Genera un análisis rápido de reseñas de un Place ID arbitrario (sin tenerlo
    // registrado como negocio). Pensado para prospección B2B: sacas las últimas
    // 30 reseñas + análisis IA + email pitch pre-redactado, el frontend genera
    // un PDF descargable. No persiste nada, no cachea.

    [HttpPost("mini-radar")]
    public async Task<IActionResult> MiniRadar([FromBody] MiniRadarRequest request)
    {
        if (!await IsAdminAsync()) return Forbid();
        if (string.IsNullOrWhiteSpace(request.PlaceId))
            return BadRequest(new { error = "place_id_required", mensaje = "Se requiere place_id" });

        _logger.LogInformation("[MiniRadar] Analizando placeId={PlaceId} nombre={Nombre}",
            request.PlaceId, request.Nombre ?? "(sin nombre)");

        // 1. Outscraper: últimas 30 reseñas del place
        var resenas = await _outscraper.GetCompetitorReviewsAsync(request.PlaceId, 30);
        if (resenas.Count == 0)
            return NotFound(new { error = "no_reviews_found", mensaje = "No se pudieron obtener reseñas para este place_id" });

        // 2. Stats locales
        var total = resenas.Count;
        var ratingAvg = resenas.Average(r => r.StarRating);
        var respondidas = resenas.Count(r => !string.IsNullOrEmpty(r.OwnerAnswer));
        var pctRespondidas = (int)Math.Round((double)respondidas / total * 100);

        var dist = new Dictionary<string, int>
        {
            ["s5"] = resenas.Count(r => r.StarRating == 5),
            ["s4"] = resenas.Count(r => r.StarRating == 4),
            ["s3"] = resenas.Count(r => r.StarRating == 3),
            ["s2"] = resenas.Count(r => r.StarRating == 2),
            ["s1"] = resenas.Count(r => r.StarRating == 1),
        };

        var hoy = DateTimeOffset.UtcNow;
        var ult30d = resenas.Count(r => r.PublishedAt >= hoy.AddDays(-30));
        var ult90d = resenas.Count(r => r.PublishedAt >= hoy.AddDays(-90));

        // 3. Las 3 peores reseñas sin responder (gancho emocional del pitch)
        var peoresSinResponder = resenas
            .Where(r => string.IsNullOrEmpty(r.OwnerAnswer) && r.StarRating <= 3 && !string.IsNullOrEmpty(r.Text))
            .OrderBy(r => r.StarRating)
            .ThenByDescending(r => r.PublishedAt)
            .Take(3)
            .Select(r => new
            {
                autor = r.AuthorName,
                rating = r.StarRating,
                texto = r.Text.Length > 240 ? r.Text[..240] + "..." : r.Text,
                fecha = r.PublishedAt,
            })
            .ToList();

        // 4. Análisis con Claude
        var resenasText = string.Join("\n", resenas.Take(30).Select(r =>
        {
            var textCorto = r.Text.Length > 200 ? r.Text[..200] : r.Text;
            var marca = string.IsNullOrEmpty(r.OwnerAnswer) ? "[SIN RESPUESTA]" : "[respondida]";
            return $"- {r.StarRating}★ \"{textCorto}\" {marca}";
        }));

        var nombreDisplay = string.IsNullOrWhiteSpace(request.Nombre) ? "el negocio" : request.Nombre;
        var systemPrompt =
            "Eres un experto en análisis de reputación online para PYMEs. " +
            "Analiza las reseñas proporcionadas y devuelve ÚNICAMENTE un JSON válido (sin markdown, sin prefijo) con esta estructura EXACTA:\n" +
            "{\n" +
            "  \"fortalezas\": [\"breve fortaleza 1 (max 90 chars)\", \"breve fortaleza 2\"],\n" +
            "  \"debilidades\": [\"breve debilidad 1 (max 90 chars)\", \"breve debilidad 2\"],\n" +
            "  \"accion\": \"una acción concreta y accionable para la semana próxima (max 140 chars)\",\n" +
            "  \"resumen\": \"3 frases resumen objetivo del estado actual de la reputación online (max 300 chars)\",\n" +
            "  \"emailPitch\": \"2 párrafos cortos de email personalizado dirigido al dueño del negocio, tono cercano pero profesional, mencionando 1 hallazgo concreto de las reseñas analizadas y proponiendo un análisis gratuito + una demo corta. Firma: Manuel, Velacre.com. NO menciones precios.\"\n" +
            "}\n" +
            "No inventes datos que no estén en las reseñas. Sé honesto y directo. No uses comillas dobles dentro de los valores de los strings JSON, usa apóstrofes si necesitas.";

        var userPrompt =
            $"Negocio: {nombreDisplay}\n" +
            $"Stats: rating medio {ratingAvg:F2}/5, {pctRespondidas}% respondidas, {ult30d} reseñas últimos 30 días, {ult90d} reseñas últimos 90 días.\n\n" +
            $"Últimas {total} reseñas (más recientes primero):\n{resenasText}";

        string analisisRaw;
        try
        {
            analisisRaw = await _aiService.GetClaudeMessageAsync(userPrompt, systemPrompt);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[MiniRadar] Error en Claude");
            return StatusCode(500, new { error = "ai_error", mensaje = ex.Message });
        }

        // Extraer JSON del texto (Claude a veces añade wrappers aunque se lo pidas)
        var jsonStart = analisisRaw.IndexOf('{');
        var jsonEnd = analisisRaw.LastIndexOf('}');
        var analisisLimpio = jsonStart >= 0 && jsonEnd > jsonStart
            ? analisisRaw[jsonStart..(jsonEnd + 1)]
            : "{}";

        JsonElement? analisisParsed = null;
        try
        {
            using var doc = JsonDocument.Parse(analisisLimpio);
            analisisParsed = doc.RootElement.Clone();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[MiniRadar] No se pudo parsear el JSON de Claude, devolviendo raw");
        }

        _logger.LogInformation("[MiniRadar] OK — total={Total} respondidas={Pct}% rating={Rating:F2} ult30d={Ult30}",
            total, pctRespondidas, ratingAvg, ult30d);

        return Ok(new
        {
            placeId = request.PlaceId,
            nombre = request.Nombre,
            stats = new
            {
                total,
                ratingAvg = Math.Round(ratingAvg, 2),
                distribucion = dist,
                pctRespondidas,
                ult30d,
                ult90d,
            },
            peoresSinResponder,
            analisis = analisisParsed,
            analisisRaw = analisisParsed == null ? analisisLimpio : null,
            generadoEn = DateTimeOffset.UtcNow,
        });
    }
}

// ─── Request records ─────────────────────────────────────────────────────────

public record CambiarEstadoRequest(string Estado, int? DiasPrueba);
public record ProOverrideRequest(bool Activo, int? DiasExpira);
public record NotasAdminRequest(string? Notas);
public record CambiarPlanRequest(string Plan);
public record SetPlaceIdRequest(string PlaceId);
public record AsignarRolRequest(string Rol);
public record MiniRadarRequest(string PlaceId, string? Nombre);
