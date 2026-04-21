using System.Text.Json;
using System.Text.Json.Nodes;
using Anthropic.SDK;
using Anthropic.SDK.Messaging;
using backend.Interfaces;
using backend.Models.Responses;
using Microsoft.Extensions.Logging;
using SdkCommon = Anthropic.SDK.Common;

namespace backend.Services;

public class ClaudeService : IReviewAiService
{
    private readonly AnthropicClient _client;
    private readonly string _model;
    private readonly ILogger<ClaudeService> _logger;

    public ClaudeService(string apiKey, HttpClient httpClient, ILogger<ClaudeService> logger)
    {
        // Pasamos nuestro propio HttpClient al SDK de Anthropic para que respete el
        // timeout configurado en Program.cs (90s). Sin esto, si Claude se cuelga,
        // el request del usuario espera indefinidamente y el thread pool se satura.
        _client = new AnthropicClient(new APIAuthentication(apiKey.Trim()), httpClient, null);
        _model = Environment.GetEnvironmentVariable("AI_MODEL") ?? "claude-sonnet-4-6";
        _logger = logger;
    }

    public async Task<(string Profesional, string Cercano, string Directo)> GenerateThreeResponsesAsync(
        string reviewText, string businessDesc)
    {
        _logger.LogInformation("[ClaudeService] Generando 3 respuestas con modelo={Model}", _model);

        var profesional = await GenerateSingleAsync(reviewText, businessDesc, "Profesional",
            "Responde de forma profesional y formal, transmitiendo excelencia y confianza. Tono serio, pulido y cercano a la calidad.");
        var cercano = await GenerateSingleAsync(reviewText, businessDesc, "Cercano",
            "Responde de forma cálida y humana, como lo haría el dueño del negocio que conoce a sus clientes. Natural, empático y genuino.");
        var directo = await GenerateSingleAsync(reviewText, businessDesc, "Directo",
            "Responde de forma clara, breve y sin rodeos. Ve al grano, sin florituras, pero siempre correcto y respetuoso.");

        _logger.LogInformation("[ClaudeService] 3 respuestas generadas correctamente");
        return (profesional, cercano, directo);
    }

    public Task<string> GenerateSingleResponseAsync(string reviewText, string businessDesc, string tone)
    {
        var instructions = tone.ToLower() switch
        {
            "cercano" => "Responde de forma cálida y humana, como lo haría el dueño del negocio que conoce a sus clientes. Natural, empático y genuino.",
            "directo" => "Responde de forma clara, breve y sin rodeos. Ve al grano, sin florituras, pero siempre correcto y respetuoso.",
            "empatico" or "empático" => "Responde de forma comprensiva y validadora. Reconoce los sentimientos del cliente, muestra que entiendes su frustración. Sin ser servil ni exagerar las disculpas.",
            "agradecido" => "Responde con gratitud genuina y calidez. Haz que el cliente sienta que su opinión importa de verdad. Incluye detalles del negocio con naturalidad para que la respuesta no suene genérica. Ideal para reseñas positivas.",
            "humoristico" or "humorístico" => "Responde con tono ligero y un toque de humor para conectar. Nunca ridiculices ni minimices la queja. El humor es un puente, no una barrera.",
            _ => "Responde de forma profesional y formal, transmitiendo excelencia y confianza. Tono serio, pulido y cercano a la calidad."
        };
        return GenerateSingleAsync(reviewText, businessDesc, tone, instructions);
    }

    public async Task<string> GetClaudeMessageAsync(string userPrompt, string systemPrompt)
    {
        _logger.LogDebug("[ClaudeService] GetClaudeMessageAsync llamado");

        var messages = new List<Message> { new Message(RoleType.User, userPrompt) };
        var parameters = new MessageParameters
        {
            Messages = messages,
            Model = _model,
            MaxTokens = 800,
            Temperature = 0.5m,
        };

        if (!string.IsNullOrEmpty(systemPrompt))
        {
            parameters.System = [new SystemMessage(systemPrompt)];
        }

        try
        {
            var response = await _client.Messages.GetClaudeMessageAsync(parameters);
            var text = response.Content.FirstOrDefault()?.ToString() ?? "";
            _logger.LogDebug("[ClaudeService] GetClaudeMessageAsync OK ({Chars} chars)", text.Length);
            return text;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[ClaudeService] Error en GetClaudeMessageAsync");
            throw;
        }
    }

    public async Task<(string Response, string ContextoCliente, string ContextoRespuesta, string[] KeywordsUsadas, bool Retenida, string MotivoRetencion)> GenerateSingleResponseWithContextAsync(
        string reviewText, string businessDesc, string tone, string reviewLanguage, string[]? keywords = null)
    {
        var instructions = tone.ToLower() switch
        {
            "cercano" => "Responde de forma cálida y humana, como lo haría el dueño del negocio que conoce a sus clientes. Natural, empático y genuino.",
            "directo" => "Responde de forma clara, breve y sin rodeos. Ve al grano, sin florituras, pero siempre correcto y respetuoso.",
            "empatico" or "empático" => "Responde de forma comprensiva y validadora. Reconoce los sentimientos del cliente, muestra que entiendes su frustración. Sin ser servil ni exagerar las disculpas.",
            "agradecido" => "Responde con gratitud genuina y calidez. Haz que el cliente sienta que su opinión importa de verdad. Incluye detalles del negocio con naturalidad para que la respuesta no suene genérica. Ideal para reseñas positivas.",
            "humoristico" or "humorístico" => "Responde con tono ligero y un toque de humor para conectar. Nunca ridiculices ni minimices la queja. El humor es un puente, no una barrera.",
            _ => "Responde de forma profesional y formal, transmitiendo excelencia y confianza. Tono serio, pulido y cercano a la calidad."
        };

        var keywordsBlock = keywords != null && keywords.Length > 0
            ? $"Palabras clave del negocio (inclúyelas con naturalidad en la respuesta si encajan, máximo 2 o 3, nunca forzadas): {string.Join(", ", keywords)}. "
            : "";

        var systemPrompt =
            $"Eres un experto en gestión de reputación online y respuesta a reseñas de clientes." +
            $"Negocio: {businessDesc}. {instructions} " +
            $"Responde SIEMPRE en el mismo idioma que la reseña (código '{reviewLanguage}'). " +
            $"Si la reseña no tiene texto, agradece la valoración basándote en las estrellas. " +
            keywordsBlock +
            "IMPORTANTE — Filtro de seguridad: antes de generar la respuesta evalúa si la reseña describe alguna de estas situaciones críticas que requieren atención humana urgente: " +
            "(1) intoxicación alimentaria real o enfermedad grave por consumo del producto, " +
            "(2) acusaciones concretas de agresión física, malos tratos o acoso grave a un empleado o cliente, " +
            "(3) amenaza explícita de denuncia judicial o demanda legal, " +
            "(4) datos personales sensibles del cliente (nombre completo + datos médicos, datos bancarios, etc.), " +
            "(5) acusaciones de fraude, estafa, engaño deliberado o cobro intencionado de más (no simples quejas de precio alto), " +
            "(6) acusaciones de discriminación por raza, etnia, nacionalidad, género, orientación sexual, religión o discapacidad. " +
            "Si detectas alguna de estas situaciones, devuelve retenida:true con motivoRetencion ('intoxicacion'|'maltrato'|'amenaza_legal'|'datos_personales'|'acusacion_fraude'|'discriminacion') y respuesta:null. " +
            "Si no, genera la respuesta normalmente con retenida:false y motivoRetencion:null. " +
            "Devuelve ÚNICAMENTE este JSON (sin markdown):\n" +
            "{\"respuesta\":\"<máx 150 palabras, mismo idioma que la reseña, o null si retenida>\"," +
            "\"contextoCliente\":\"<1 frase en español>\"," +
            "\"contextoRespuesta\":\"<1 frase en español>\"," +
            "\"keywordsUsadas\":[\"<keywords usadas, array vacío si ninguna>\"]," +
            "\"retenida\":false," +
            "\"motivoRetencion\":null}";

        var parameters = new MessageParameters
        {
            Messages = [new Message(RoleType.User, $"Reseña: '{reviewText}'")],
            Model = _model,
            MaxTokens = 500,
            Temperature = 0.7m,
            System = [new SystemMessage(systemPrompt)]
        };

        const int maxRetries = 3;
        for (int attempt = 1; attempt <= maxRetries; attempt++)
        {
            try
            {
                var apiResponse = await _client.Messages.GetClaudeMessageAsync(parameters);
                var raw = apiResponse.Content.FirstOrDefault()?.ToString() ?? "";

                var jsonStart = raw.IndexOf('{');
                var jsonEnd   = raw.LastIndexOf('}');
                if (jsonStart >= 0 && jsonEnd > jsonStart)
                {
                    var doc = System.Text.Json.JsonDocument.Parse(raw[jsonStart..(jsonEnd + 1)]);
                    var respuesta       = doc.RootElement.TryGetProperty("respuesta", out var rp) && rp.ValueKind != System.Text.Json.JsonValueKind.Null ? rp.GetString() ?? "" : "";
                    var contextoCliente = doc.RootElement.TryGetProperty("contextoCliente", out var cc) ? cc.GetString() ?? "" : "";
                    var contextoResp    = doc.RootElement.TryGetProperty("contextoRespuesta", out var cr) ? cr.GetString() ?? "" : "";
                    var retenida        = doc.RootElement.TryGetProperty("retenida", out var ret) && ret.ValueKind == System.Text.Json.JsonValueKind.True;
                    var motivo          = doc.RootElement.TryGetProperty("motivoRetencion", out var mv) && mv.ValueKind != System.Text.Json.JsonValueKind.Null ? mv.GetString() ?? "" : "";
                    string[] kwUsadas   = [];
                    if (doc.RootElement.TryGetProperty("keywordsUsadas", out var kwElement) && kwElement.ValueKind == System.Text.Json.JsonValueKind.Array)
                    {
                        kwUsadas = kwElement.EnumerateArray()
                            .Select(e => e.GetString() ?? "")
                            .Where(s => !string.IsNullOrWhiteSpace(s))
                            .ToArray();
                    }
                    if (retenida) _logger.LogWarning("[ClaudeService] Reseña retenida por seguridad: motivo={Motivo}", motivo);
                    return (respuesta, contextoCliente, contextoResp, kwUsadas, retenida, motivo);
                }

                _logger.LogWarning("[ClaudeService] GenerateSingleResponseWithContextAsync: JSON no encontrado en respuesta");
                return (raw.Trim(), "", "", [], false, "");
            }
            catch (Exception ex) when (attempt < maxRetries && ex.Message.Contains("overloaded_error"))
            {
                var delay = TimeSpan.FromSeconds(Math.Pow(2, attempt));
                _logger.LogWarning("[ClaudeService] Overloaded (intento {Attempt}/{Max}), reintentando en {Delay}s...", attempt, maxRetries, delay.TotalSeconds);
                await Task.Delay(delay);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[ClaudeService] Error en GenerateSingleResponseWithContextAsync tono={Tone}", tone);
                throw;
            }
        }
        throw new InvalidOperationException("Claude API overloaded tras 3 intentos");
    }

    public async Task<(string Profesional, string Cercano, string Directo, string ContextoCliente, string ContextoRespuesta, bool Retenida, string MotivoRetencion)> GenerateThreeResponsesWithSafeFilterAsync(
        string reviewText, string businessDesc)
    {
        _logger.LogInformation("[ClaudeService] GenerateThreeResponsesWithSafeFilterAsync — modelo={Model}", _model);

        var systemPrompt =
            $"Eres un experto en gestión de reputación online y respuesta a reseñas de clientes." +
            $"Negocio: {businessDesc}. " +
            "IMPORTANTE — Filtro de seguridad: antes de generar respuestas evalúa si la reseña describe alguna situación crítica: " +
            "(1) intoxicación alimentaria real o enfermedad grave, " +
            "(2) acusaciones de agresión física, malos tratos o acoso grave, " +
            "(3) amenaza explícita de denuncia judicial o demanda legal, " +
            "(4) datos personales sensibles (nombre + datos médicos/bancarios), " +
            "(5) acusaciones de fraude, estafa, engaño deliberado o cobro intencionado de más (no simples quejas de precio alto), " +
            "(6) acusaciones de discriminación por raza, etnia, nacionalidad, género, orientación sexual, religión o discapacidad. " +
            "Si detectas alguna, devuelve retenida:true y profesional/cercano/directo:null. " +
            "Si no, genera 3 respuestas en el mismo idioma que la reseña. Máximo 150 palabras cada una. " +
            "Tono Profesional: formal y pulido. Tono Cercano: cálido y humano. Tono Directo: breve y claro. " +
            "Devuelve ÚNICAMENTE este JSON (sin markdown):\n" +
            "{\"retenida\":false,\"motivoRetencion\":null," +
            "\"contextoCliente\":\"<1 frase en español resumiendo qué menciona el cliente>\"," +
            "\"contextoRespuesta\":\"<1 frase en español resumiendo qué aborda la respuesta>\"," +
            "\"profesional\":\"<respuesta o null>\",\"cercano\":\"<respuesta o null>\",\"directo\":\"<respuesta o null>\"}";

        var parameters = new MessageParameters
        {
            Messages = [new Message(RoleType.User, $"Reseña: '{reviewText}'")],
            Model = _model,
            MaxTokens = 1200,
            Temperature = 0.7m,
            System = [new SystemMessage(systemPrompt)]
        };

        const int maxRetries = 3;
        for (int attempt = 1; attempt <= maxRetries; attempt++)
        {
            try
            {
                var apiResponse = await _client.Messages.GetClaudeMessageAsync(parameters);
                var raw = apiResponse.Content.FirstOrDefault()?.ToString() ?? "";

                var jsonStart = raw.IndexOf('{');
                var jsonEnd   = raw.LastIndexOf('}');
                if (jsonStart >= 0 && jsonEnd > jsonStart)
                {
                    var doc = System.Text.Json.JsonDocument.Parse(raw[jsonStart..(jsonEnd + 1)]);
                    var retenida = doc.RootElement.TryGetProperty("retenida", out var ret) && ret.ValueKind == System.Text.Json.JsonValueKind.True;
                    var motivo   = doc.RootElement.TryGetProperty("motivoRetencion", out var mv) && mv.ValueKind != System.Text.Json.JsonValueKind.Null ? mv.GetString() ?? "" : "";

                    if (retenida)
                    {
                        _logger.LogWarning("[ClaudeService] Reseña manual retenida: motivo={Motivo}", motivo);
                        return ("", "", "", "", "", true, motivo);
                    }

                    var profesional      = doc.RootElement.TryGetProperty("profesional",      out var p)  && p.ValueKind  != System.Text.Json.JsonValueKind.Null ? p.GetString()  ?? "" : "";
                    var cercano          = doc.RootElement.TryGetProperty("cercano",          out var c)  && c.ValueKind  != System.Text.Json.JsonValueKind.Null ? c.GetString()  ?? "" : "";
                    var directo          = doc.RootElement.TryGetProperty("directo",          out var d)  && d.ValueKind  != System.Text.Json.JsonValueKind.Null ? d.GetString()  ?? "" : "";
                    var contextoCliente  = doc.RootElement.TryGetProperty("contextoCliente",  out var cc) && cc.ValueKind != System.Text.Json.JsonValueKind.Null ? cc.GetString() ?? "" : "";
                    var contextoResp     = doc.RootElement.TryGetProperty("contextoRespuesta",out var cr) && cr.ValueKind != System.Text.Json.JsonValueKind.Null ? cr.GetString() ?? "" : "";
                    return (profesional, cercano, directo, contextoCliente, contextoResp, false, "");
                }

                _logger.LogWarning("[ClaudeService] GenerateThreeResponsesWithSafeFilterAsync: JSON no encontrado");
                // Fallback to raw text
                return (raw.Trim(), "", "", "", "", false, "");
            }
            catch (Exception ex) when (attempt < maxRetries && ex.Message.Contains("overloaded_error"))
            {
                var delay = TimeSpan.FromSeconds(Math.Pow(2, attempt));
                _logger.LogWarning("[ClaudeService] Overloaded (intento {Attempt}/{Max}), reintentando en {Delay}s...", attempt, maxRetries, delay.TotalSeconds);
                await Task.Delay(delay);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[ClaudeService] Error en GenerateThreeResponsesWithSafeFilterAsync");
                throw;
            }
        }
        throw new InvalidOperationException("Claude API overloaded tras 3 intentos");
    }

    // ─── Structured output helper ────────────────────────────────────────────
    // Fuerza a Claude a llamar a un tool con schema JSON estricto. La API valida
    // los argumentos contra el schema antes de devolvernos la respuesta, así que
    // el objeto deserializado siempre cumple el contrato (o la llamada falla).
    // Reintenta ante errores transitorios (overloaded / red) y logea el uso real
    // de tokens para poder ajustar MaxTokens con datos empíricos.
    // ─────────────────────────────────────────────────────────────────────────
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    private async Task<T> GetStructuredOutputAsync<T>(
        string systemPrompt,
        string userPrompt,
        string toolName,
        string toolDescription,
        JsonNode inputSchema,
        int maxTokens,
        string logContext,
        decimal temperature = 0.5m) where T : class
    {
        SdkCommon.Tool tool = new SdkCommon.Function(toolName, toolDescription, inputSchema);

        var parameters = new MessageParameters
        {
            Messages    = [new Message(RoleType.User, userPrompt)],
            Model       = _model,
            MaxTokens   = maxTokens,
            Temperature = temperature,
            System      = string.IsNullOrEmpty(systemPrompt) ? null : [new SystemMessage(systemPrompt)],
            Tools       = [tool],
            ToolChoice  = new ToolChoice { Type = ToolChoiceType.Tool, Name = toolName },
        };

        const int maxAttempts = 2;
        Exception? lastEx = null;

        for (int attempt = 1; attempt <= maxAttempts; attempt++)
        {
            try
            {
                var response = await _client.Messages.GetClaudeMessageAsync(parameters);

                if (response.Usage is not null)
                {
                    _logger.LogInformation(
                        "[ClaudeService] {Ctx} usage in={In} out={Out} (maxTokens={Max}, stop={Stop})",
                        logContext, response.Usage.InputTokens, response.Usage.OutputTokens,
                        maxTokens, response.StopReason ?? "?");
                }

                var toolUse = response.Content?
                    .OfType<ToolUseContent>()
                    .FirstOrDefault(c => c.Name == toolName);

                if (toolUse?.Input is null)
                {
                    lastEx = new InvalidOperationException(
                        $"Claude no emitió tool_use '{toolName}' (stop={response.StopReason})");
                    _logger.LogWarning("[ClaudeService] {Ctx} sin tool_use (intento {N}/{Max})",
                        logContext, attempt, maxAttempts);
                    continue;
                }

                var parsed = toolUse.Input.Deserialize<T>(JsonOpts);
                if (parsed is null)
                {
                    lastEx = new InvalidOperationException("Deserialización de tool_use.Input devolvió null");
                    _logger.LogWarning("[ClaudeService] {Ctx} deserialize null (intento {N}/{Max}). Raw: {Raw}",
                        logContext, attempt, maxAttempts, toolUse.Input.ToJsonString());
                    continue;
                }

                return parsed;
            }
            catch (Exception ex) when (attempt < maxAttempts && IsTransient(ex))
            {
                lastEx = ex;
                var delay = TimeSpan.FromSeconds(Math.Pow(2, attempt));
                _logger.LogWarning(ex, "[ClaudeService] {Ctx} transient (intento {N}/{Max}), reintentando en {Delay}s",
                    logContext, attempt, maxAttempts, delay.TotalSeconds);
                await Task.Delay(delay);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[ClaudeService] {Ctx} error no recuperable", logContext);
                throw;
            }
        }

        _logger.LogError(lastEx, "[ClaudeService] {Ctx} agotó reintentos", logContext);
        throw new InvalidOperationException(
            $"[ClaudeService] {logContext} falló tras {maxAttempts} intentos: {lastEx?.Message}", lastEx);
    }

    private static bool IsTransient(Exception ex)
    {
        var msg = ex.Message ?? string.Empty;
        return msg.Contains("overloaded_error", StringComparison.OrdinalIgnoreCase)
            || msg.Contains("rate_limit", StringComparison.OrdinalIgnoreCase)
            || ex is HttpRequestException
            || ex is TaskCanceledException;
    }

    public async Task<RadarAnalysis> AnalyzeRadarAsync(
        string miNegocioNombre,
        List<string> misResenas,
        List<(string Nombre, List<string> Resenas)> competidores)
    {
        _logger.LogInformation("[ClaudeService] AnalyzeRadarAsync — negocio={Negocio}, competidores={Count}",
            miNegocioNombre, competidores.Count);

        var sb = new System.Text.StringBuilder();
        sb.AppendLine($"## Tu negocio: {miNegocioNombre}");
        sb.AppendLine($"Últimas reseñas ({misResenas.Count}):");
        foreach (var r in misResenas.Take(25)) sb.AppendLine($"- {r}");

        foreach (var (nombre, resenas) in competidores)
        {
            sb.AppendLine($"\n## Competidor: {nombre}");
            sb.AppendLine($"Últimas reseñas ({resenas.Count}):");
            foreach (var r in resenas.Take(20)) sb.AppendLine($"- {r}");
        }

        var systemPrompt =
            "Eres un experto en gestión de reputación online. Analizas las reseñas reales de un negocio y sus competidores. " +
            "Sé específico, directo y accionable — nada de frases genéricas. Máximo 2 frases por campo de texto. " +
            "Identifica exactamente 4 categorías que emergen de las reseñas (comida, trato, limpieza, precio, ambiente, servicio, rapidez, u otras que realmente aparezcan). " +
            "Para cada categoría puntúa el sentimiento de 0.0 a 10.0 (0=muy negativo, 10=muy positivo) basándote en las reseñas reales del negocio y de cada competidor mencionado. " +
            "El campo 'amenaza' de cada competidor debe ser exactamente uno de: 'alta', 'media', 'baja'. " +
            "Llama a la herramienta 'registrar_analisis_radar' con los resultados. No devuelvas texto fuera de la herramienta.";

        return await GetStructuredOutputAsync<RadarAnalysis>(
            systemPrompt:    systemPrompt,
            userPrompt:      sb.ToString(),
            toolName:        "registrar_analisis_radar",
            toolDescription: "Registra el análisis comparativo de reputación del negocio frente a sus competidores.",
            inputSchema:     BuildRadarSchema(),
            maxTokens:       2500,
            logContext:      "AnalyzeRadarAsync",
            temperature:     0.4m);
    }

    private static JsonNode BuildRadarSchema() => JsonNode.Parse("""
    {
      "type": "object",
      "properties": {
        "tuFortaleza":  { "type": "string", "description": "Mayor fortaleza del negocio frente a competidores, basada en reseñas reales. Máx 2 frases." },
        "tuDebilidad":  { "type": "string", "description": "Mayor debilidad del negocio frente a competidores, concreta y accionable. Máx 2 frases." },
        "competidores": {
          "type": "array",
          "description": "Un item por competidor analizado. Respeta el orden y los nombres recibidos.",
          "items": {
            "type": "object",
            "properties": {
              "nombre":    { "type": "string", "description": "Nombre del competidor, tal como fue recibido." },
              "fortaleza": { "type": "string", "description": "Fortaleza clara de este competidor. Máx 1-2 frases." },
              "debilidad": { "type": "string", "description": "Debilidad clara de este competidor. Máx 1-2 frases." },
              "amenaza":   { "type": "string", "enum": ["alta", "media", "baja"], "description": "Nivel de amenaza competitiva." }
            },
            "required": ["nombre", "fortaleza", "debilidad", "amenaza"]
          }
        },
        "oportunidades": {
          "type": "array",
          "description": "Oportunidades concretas que emergen del análisis. 2-4 items, cada uno una frase accionable.",
          "items": { "type": "string" }
        },
        "accion":       { "type": "string", "description": "Una acción concreta que puedes hacer esta semana. Máx 2 frases." },
        "categorias": {
          "type": "array",
          "description": "Exactamente 4 categorías relevantes con puntuaciones 0-10.",
          "items": {
            "type": "object",
            "properties": {
              "nombre":  { "type": "string", "description": "Nombre corto de la categoría (ej: 'comida', 'trato', 'limpieza')." },
              "yo":      { "type": "number", "description": "Puntuación 0.0-10.0 del negocio propio en esta categoría." },
              "rivales": {
                "type": "array",
                "description": "Un item por competidor con su score 0-10 en esta categoría.",
                "items": {
                  "type": "object",
                  "properties": {
                    "nombre": { "type": "string" },
                    "score":  { "type": "number", "description": "0.0-10.0" }
                  },
                  "required": ["nombre", "score"]
                }
              },
              "insight": { "type": "string", "description": "Una frase accionable basada en la diferencia entre tu score y el de los rivales." }
            },
            "required": ["nombre", "yo", "rivales", "insight"]
          }
        },
        "accionPro":    { "type": "string", "description": "Acción concreta basada en dónde tu competencia falla esta semana. Máx 2 frases." }
      },
      "required": ["tuFortaleza", "tuDebilidad", "competidores", "oportunidades", "accion", "categorias", "accionPro"]
    }
    """)!;

    private async Task<string> GenerateSingleAsync(
        string reviewText, string businessDesc, string tone, string toneInstructions)
    {
        _logger.LogDebug("[ClaudeService] Llamando API para tono={Tone}", tone);

        var parameters = new MessageParameters
        {
            Messages = [new Message(RoleType.User, $"Genera una respuesta para esta reseña: '{reviewText}'")],
            Model = _model,
            MaxTokens = 600,
            Temperature = 0.7m,
            System =
            [
                new SystemMessage(
                    $"Eres un experto en gestión de reputación online y respuesta a reseñas de clientes." +
                    $"Negocio: {businessDesc}. " +
                    $"Tono: {tone}. {toneInstructions} " +
                    $"Si la reseña no tiene texto escrito, genera igualmente una respuesta agradeciendo la valoración y basándote en la puntuación de estrellas. " +
                    $"Genera SOLO la respuesta, sin títulos ni explicaciones. Máximo 150 palabras.")
            ]
        };

        try
        {
            var response = await _client.Messages.GetClaudeMessageAsync(parameters);
            var text = response.Content.FirstOrDefault()?.ToString() ?? "No se pudo generar la respuesta.";
            _logger.LogDebug("[ClaudeService] Respuesta OK para tono={Tone} ({Chars} chars)", tone, text.Length);
            return text;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[ClaudeService] Error llamando Anthropic API para tono={Tone}", tone);
            throw;
        }
    }

    public async Task<MiniRadarAnalysis> AnalyzeMiniRadarAsync(string nombreNegocio, string resenasText,
        double ratingAvg, int pctRespondidas, int totalAnalizadas,
        DateTimeOffset fechaDesde, DateTimeOffset fechaHasta)
    {
        // El system prompt ya no describe la estructura JSON — eso vive en el schema.
        // Aquí solo las reglas de tono, contenido y qué evitar. Esto reduce input tokens
        // y concentra al modelo en el contenido en lugar de en la forma.
        const string systemPrompt =
            "Eres un asesor de confianza que ayuda a dueños de bares, restaurantes, hoteles y clínicas pequeñas a entender qué dicen sus clientes en Google. " +
            "LENGUAJE: tu audiencia son dueños de PYMEs gallegas que NO son técnicos. NO uses NUNCA jerga como 'SEO', 'CTR', 'ranking', 'visibilidad orgánica', 'posicionamiento web', 'keywords', 'engagement', 'conversion', 'call-to-action', 'KPI', 'sentiment', 'review management', 'reputación online', 'presencia digital'. " +
            "Habla como hablaría un amigo del dueño: 'salir antes cuando alguien busca en Google', 'que más gente te vea y entre a comer', 'aparecer arriba cuando buscan en tu zona', 'que Google recomiende tu negocio', 'la primera impresión que dan las estrellas', 'lo que leen los clientes antes de reservar'. Frases cortas. Palabras normales. Puedes usar expresiones gallegas naturales si encajan pero sin forzar.\n\n" +
            "SOBRE 'oportunidad': busca UN patrón de mejora claro que el dueño no ve y que se puede arreglar con acción específica. Patrones válidos típicos: respuestas clonadas (todas iguales), positivas sin contestar (4-5★ sin respuesta), queja repetida ignorada (3+ reseñas mencionan lo mismo sin que las respuestas lo aborden), respuestas impersonales (solo agradecen genérico), velocidad asimétrica (5★ contestadas rápido, 1-2★ dejadas días), falta de firma personal. " +
            "Si NO hay un patrón claro y evidente, devuelve oportunidad=null. PROHIBIDO inventar patrones o exagerar.\n\n" +
            "REGLAS DURAS: (1) No inventes datos que no estén en las reseñas. (2) Si usas la palabra 'SEO'/'ranking'/'CTR' reescríbelo en lenguaje humano antes de devolver. (3) Los ejemplos de oportunidad deben ser extractos reales, mencionando nombre del cliente si aparece. (4) Puntuación correcta: sin espacio antes de coma/punto ('hola, qué tal' no 'hola , qué tal'). (5) No empieces items de arrays con guión — el PDF ya pinta su bullet.\n\n" +
            "El emailPitch debe ser 2 párrafos cortos dirigidos al dueño como si fueras un vecino que ha notado algo, mencionar 1 hallazgo concreto de las reseñas, proponer mandarle el informe PDF gratis sin compromiso, firmado 'Manuel, Velacre.com'. Sin precios, sin jerga, cercano y honesto.";

        var desdeStr  = fechaDesde.ToString("d MMM yyyy", new System.Globalization.CultureInfo("es-ES"));
        var hastaStr  = fechaHasta.ToString("d MMM yyyy", new System.Globalization.CultureInfo("es-ES"));
        var rangoDias = (int)Math.Round((fechaHasta - fechaDesde).TotalDays);

        var userPrompt =
            $"Negocio: {nombreNegocio}\n" +
            $"Stats: {totalAnalizadas} reseñas analizadas (publicadas entre {desdeStr} y {hastaStr}, rango de {rangoDias} días), rating medio {ratingAvg:F2}/5, {pctRespondidas}% respondidas por el propietario.\n\n" +
            $"IMPORTANTE sobre el alcance: NO digas 'últimos 30 días' ni 'último mes'. Di 'las reseñas analizadas', 'las últimas N reseñas', o menciona el rango real (ej: 'desde mediados de marzo'). El sample puede cubrir menos de 30 días si el negocio tiene mucha actividad.\n\n" +
            $"Reseñas analizadas (más recientes primero):\n{resenasText}\n\n" +
            $"Llama a la herramienta 'registrar_analisis_mini_radar' con el resultado completo.";

        return await GetStructuredOutputAsync<MiniRadarAnalysis>(
            systemPrompt:    systemPrompt,
            userPrompt:      userPrompt,
            toolName:        "registrar_analisis_mini_radar",
            toolDescription: "Registra el análisis del mini-radar con fortalezas, debilidades, acción, resumen, email pitch y (si procede) una oportunidad detectada.",
            inputSchema:     BuildMiniRadarSchema(),
            maxTokens:       1500,
            logContext:      "AnalyzeMiniRadarAsync",
            temperature:     0.5m);
    }

    private static JsonNode BuildMiniRadarSchema() => JsonNode.Parse("""
    {
      "type": "object",
      "properties": {
        "fortalezas": {
          "type": "array",
          "description": "Exactamente 2 fortalezas, cada una una frase humana y concreta extraída de las reseñas. Máx 90 chars cada una. Sin jerga.",
          "items": { "type": "string" },
          "minItems": 2,
          "maxItems": 2
        },
        "debilidades": {
          "type": "array",
          "description": "Exactamente 2 debilidades, cada una una frase humana y concreta. Máx 90 chars cada una. Sin jerga.",
          "items": { "type": "string" },
          "minItems": 2,
          "maxItems": 2
        },
        "accion": {
          "type": "string",
          "description": "Una acción concreta y accionable para esta semana, en lenguaje de dueño de bar (máx 140 chars). Ejemplo bueno: 'Responded a las 5 últimas reseñas negativas hoy mismo'. Sin jerga tipo 'optimizar CTR'."
        },
        "resumen": {
          "type": "string",
          "description": "3 frases resumen del estado actual, en lenguaje humano sin tecnicismos (máx 300 chars). Habla de estrellas, qué dicen los clientes y qué pasa con las respuestas."
        },
        "emailPitch": {
          "type": "string",
          "description": "2 párrafos cortos dirigidos al dueño como vecino que quiere ayudar. Menciona 1 hallazgo concreto. Propone enviar el informe PDF gratis. Firma 'Manuel, Velacre.com'. Sin precios ni jerga."
        },
        "oportunidad": {
          "type": ["object", "null"],
          "description": "Un patrón claro detectado en los datos. null si no hay patrón evidente (prohibido inventar).",
          "properties": {
            "titulo":      { "type": "string", "description": "Nombre corto EN MAYÚSCULAS del patrón (máx 50 chars). Ej: 'POSITIVAS SIN CONTESTAR', 'QUEJA REPETIDA IGNORADA'." },
            "descripcion": { "type": "string", "description": "2-3 frases explicando el patrón y por qué le importa al dueño (máx 400 chars). Concreto, con datos reales." },
            "ejemplos":    {
              "type": "array",
              "description": "2-3 extractos reales de las reseñas. Cada ejemplo menciona nombre del cliente si aparece (máx 140 chars).",
              "items": { "type": "string" },
              "minItems": 2,
              "maxItems": 3
            }
          },
          "required": ["titulo", "descripcion", "ejemplos"]
        }
      },
      "required": ["fortalezas", "debilidades", "accion", "resumen", "emailPitch", "oportunidad"]
    }
    """)!;
}
