using Anthropic.SDK;
using Anthropic.SDK.Messaging;
using backend.Interfaces;
using Microsoft.Extensions.Logging;

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
            "(5) acusaciones de fraude, estafa, engaño deliberado o cobro intencionado de más (no simples quejas de precio alto). " +
            "Si detectas alguna de estas situaciones, devuelve retenida:true con motivoRetencion ('intoxicacion'|'maltrato'|'amenaza_legal'|'datos_personales'|'acusacion_fraude') y respuesta:null. " +
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
            "(5) acusaciones de fraude, estafa, engaño deliberado o cobro intencionado de más (no simples quejas de precio alto). " +
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

    public async Task<string> GenerateRadarAnalysisAsync(
        string miNegocioNombre,
        List<string> misResenas,
        List<(string Nombre, List<string> Resenas)> competidores)
    {
        _logger.LogInformation("[ClaudeService] GenerateRadarAnalysisAsync — negocio={Negocio}, competidores={Count}", miNegocioNombre, competidores.Count);

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

        var competidoresSchema = string.Join(",", competidores.Select(c =>
            $"{{\"nombre\":\"{c.Nombre}\",\"fortaleza\":\"...\",\"debilidad\":\"...\",\"amenaza\":\"alta|media|baja\"}}"));

        var systemPrompt =
            "Eres un experto en gestión de reputación online. Analiza las reseñas reales de un negocio y sus competidores." +
            "Sé específico, directo y accionable — nada de frases genéricas. Máximo 2 frases por campo. " +
            "Identifica las 4 categorías más relevantes que emergen de las reseñas (p.ej: comida, trato, limpieza, precio, ambiente, servicio, rapidez...). " +
            "Para cada categoría puntúa el sentimiento de 0-10 (0=muy negativo, 10=muy positivo) basándote en las reseñas reales. " +
            "Devuelve ÚNICAMENTE este JSON (sin markdown):\n" +
            "{\"tuFortaleza\":\"...\",\"tuDebilidad\":\"...\"," +
            "\"competidores\":[{\"nombre\":\"...\",\"fortaleza\":\"...\",\"debilidad\":\"...\",\"amenaza\":\"alta|media|baja\"}]," +
            "\"oportunidades\":[\"...\",\"...\"]," +
            "\"accion\":\"Una acción concreta que puedes hacer esta semana\"," +
            "\"categorias\":[{\"nombre\":\"...\",\"yo\":8.5,\"rivales\":[{\"nombre\":\"...\",\"score\":7.2}],\"insight\":\"1 frase accionable basada en la diferencia\"}]," +
            "\"accionPro\":\"Acción concreta y específica basada en donde tu competencia falla esta semana\"}";

        var parameters = new MessageParameters
        {
            Messages = [new Message(RoleType.User, sb.ToString())],
            Model    = _model,
            MaxTokens = 2200,
            Temperature = 0.5m,
            System = [new SystemMessage(systemPrompt)]
        };

        try
        {
            var response = await _client.Messages.GetClaudeMessageAsync(parameters);
            var raw = response.Content.FirstOrDefault()?.ToString() ?? "{}";
            var jsonStart = raw.IndexOf('{');
            var jsonEnd   = raw.LastIndexOf('}');
            return jsonStart >= 0 && jsonEnd > jsonStart ? raw[jsonStart..(jsonEnd + 1)] : raw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[ClaudeService] Error en GenerateRadarAnalysisAsync");
            throw;
        }
    }

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
}
