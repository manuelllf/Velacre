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

    public ClaudeService(string apiKey, ILogger<ClaudeService> logger)
    {
        _client = new AnthropicClient(apiKey.Trim());
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

    public async Task<(string Response, string ContextoCliente, string ContextoRespuesta, string[] KeywordsUsadas)> GenerateSingleResponseWithContextAsync(
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
            $"Eres un experto en reputación online para hostelería en Ferrol, Galicia. " +
            $"Negocio: {businessDesc}. {instructions} " +
            $"Responde SIEMPRE en el mismo idioma que la reseña (código '{reviewLanguage}'). " +
            $"Si la reseña no tiene texto, agradece la valoración basándote en las estrellas. " +
            keywordsBlock +
            "Devuelve ÚNICAMENTE este JSON (sin markdown):\n" +
            "{\"respuesta\":\"<máx 150 palabras, mismo idioma que la reseña>\"," +
            "\"contextoCliente\":\"<1 frase en español>\"," +
            "\"contextoRespuesta\":\"<1 frase en español>\"," +
            "\"keywordsUsadas\":[\"<keywords usadas, array vacío si ninguna>\"]}";

        var parameters = new MessageParameters
        {
            Messages = [new Message(RoleType.User, $"Reseña: '{reviewText}'")],
            Model = _model,
            MaxTokens = 450,
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
                    var respuesta        = doc.RootElement.GetProperty("respuesta").GetString() ?? "";
                    var contextoCliente  = doc.RootElement.GetProperty("contextoCliente").GetString() ?? "";
                    var contextoResp     = doc.RootElement.GetProperty("contextoRespuesta").GetString() ?? "";
                    string[] kwUsadas    = [];
                    if (doc.RootElement.TryGetProperty("keywordsUsadas", out var kwElement) && kwElement.ValueKind == System.Text.Json.JsonValueKind.Array)
                    {
                        kwUsadas = kwElement.EnumerateArray()
                            .Select(e => e.GetString() ?? "")
                            .Where(s => !string.IsNullOrWhiteSpace(s))
                            .ToArray();
                    }
                    return (respuesta, contextoCliente, contextoResp, kwUsadas);
                }

                _logger.LogWarning("[ClaudeService] GenerateSingleResponseWithContextAsync: JSON no encontrado en respuesta");
                return (raw.Trim(), "", "", []);
            }
            catch (Exception ex) when (attempt < maxRetries && ex.Message.Contains("overloaded_error"))
            {
                var delay = TimeSpan.FromSeconds(Math.Pow(2, attempt)); // 2s, 4s
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
                    $"Eres un experto en reputación online para hostelería en Ferrol, Galicia. " +
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
