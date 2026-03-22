using Anthropic.SDK;
using Anthropic.SDK.Messaging;
using backend.Interfaces;

namespace backend.Services;

public class ClaudeService : IReviewAiService
{
    private readonly AnthropicClient _client;
    private readonly string _model;

    public ClaudeService(string apiKey)
    {
        _client = new AnthropicClient(apiKey.Trim());
        _model = Environment.GetEnvironmentVariable("AI_MODEL") ?? "claude-sonnet-4-6";
    }

    public async Task<(string Profesional, string Colegueo, string Orgullosa)> GenerateThreeResponsesAsync(
        string reviewText, string businessDesc)
    {
        var results = await Task.WhenAll(
            GenerateSingleAsync(reviewText, businessDesc, "Profesional",
                "Responde de forma profesional, formal y cortés. Tono empresarial serio pero humano."),
            GenerateSingleAsync(reviewText, businessDesc, "Colegueo",
                "Responde de forma cercana e informal, como si hablaras con un amigo del barrio. Natural y espontáneo."),
            GenerateSingleAsync(reviewText, businessDesc, "Orgullosa",
                "Responde con orgullo gallego. Menciona la tradición local de Galicia y el amor por la tierra. Puedes usar alguna expresión en gallego.")
        );

        return (results[0], results[1], results[2]);
    }

    private async Task<string> GenerateSingleAsync(
        string reviewText, string businessDesc, string tone, string toneInstructions)
    {
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

        var response = await _client.Messages.GetClaudeMessageAsync(parameters);
        return response.Content.FirstOrDefault()?.ToString() ?? "No se pudo generar la respuesta.";
    }
}
