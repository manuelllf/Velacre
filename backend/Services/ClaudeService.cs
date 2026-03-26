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

    public async Task<(string Response, string ContextoCliente, string ContextoRespuesta)> GenerateSingleResponseWithContextAsync(
        string reviewText, string businessDesc, string tone, string reviewLanguage)
    {
        var instructions = tone.ToLower() switch
        {
            "cercano" => "Responde de forma cálida y humana, como lo haría el dueño del negocio que conoce a sus clientes. Natural, empático y genuino.",
            "directo" => "Responde de forma clara, breve y sin rodeos. Ve al grano, sin florituras, pero siempre correcto y respetuoso.",
            _ => "Responde de forma profesional y formal, transmitiendo excelencia y confianza. Tono serio, pulido y cercano a la calidad."
        };

        var systemPrompt =
            $"Eres un experto en reputación online para hostelería en Ferrol, Galicia. " +
            $"Negocio: {businessDesc}. Tono: {tone}. {instructions} " +
            $"IMPORTANTE: La reseña está escrita en '{reviewLanguage}'. " +
            $"La respuesta DEBE estar escrita en ese mismo idioma ('{reviewLanguage}'). " +
            $"Si la reseña es en español ('es'), responde en español. Si es en inglés ('en'), responde en inglés. Si es en gallego ('gl'), responde en gallego. Etc. " +
            $"Si la reseña no tiene texto escrito, genera igualmente una respuesta agradeciendo la valoración y basándote en la puntuación de estrellas. " +
            $"Devuelve ÚNICAMENTE este JSON (sin markdown, sin texto extra):\n" +
            "{\"respuesta\":\"<respuesta en el idioma de la reseña, máx 150 palabras>\"," +
            "\"contextoCliente\":\"<una frase en español resumiendo qué dijo el cliente>\"," +
            "\"contextoRespuesta\":\"<una frase en español resumiendo qué responde el negocio>\"}";

        var parameters = new MessageParameters
        {
            Messages = [new Message(RoleType.User, $"Genera una respuesta para esta reseña: '{reviewText}'")],
            Model = _model,
            MaxTokens = 700,
            Temperature = 0.7m,
            System = [new SystemMessage(systemPrompt)]
        };

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
                return (respuesta, contextoCliente, contextoResp);
            }

            // Fallback: si Claude no devolvió JSON válido, tratar todo como respuesta
            _logger.LogWarning("[ClaudeService] GenerateSingleResponseWithContextAsync: JSON no encontrado en respuesta");
            return (raw.Trim(), "", "");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[ClaudeService] Error en GenerateSingleResponseWithContextAsync tono={Tone}", tone);
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
