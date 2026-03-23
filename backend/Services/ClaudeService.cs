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

    public async Task<(string Profesional, string Colegueo, string Orgullosa)> GenerateThreeResponsesAsync(
        string reviewText, string businessDesc)
    {
        _logger.LogInformation("[ClaudeService] Generando 3 respuestas con modelo={Model}", _model);

        var profesional = await GenerateSingleAsync(reviewText, businessDesc, "Profesional",
            "Responde de forma profesional, formal y cortés. Tono empresarial serio pero humano.");
        var colegueo = await GenerateSingleAsync(reviewText, businessDesc, "Colegueo",
            "Responde de forma cercana e informal, como si hablaras con un amigo del barrio. Natural y espontáneo.");
        var orgullosa = await GenerateSingleAsync(reviewText, businessDesc, "Orgullosa",
            "Responde con altivez y cierta soberbia elegante. Tono seguro de sí mismo, casi condescendiente pero sin ser grosero. Como quien sabe que su negocio es excelente y no necesita justificarse en exceso. Distante y distinguido.");

        _logger.LogInformation("[ClaudeService] 3 respuestas generadas correctamente");
        return (profesional, colegueo, orgullosa);
    }

    public Task<string> GenerateSingleResponseAsync(string reviewText, string businessDesc, string tone)
    {
        var instructions = tone.ToLower() switch
        {
            "colegueo" => "Responde de forma cercana e informal, como si hablaras con un amigo del barrio. Natural y espontáneo.",
            "orgullosa" => "Responde con altivez y cierta soberbia elegante. Tono seguro de sí mismo, casi condescendiente pero sin ser grosero. Como quien sabe que su negocio es excelente y no necesita justificarse en exceso. Distante y distinguido.",
            _ => "Responde de forma profesional, formal y cortés. Tono empresarial serio pero humano."
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
