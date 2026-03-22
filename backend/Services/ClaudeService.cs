using Anthropic.SDK;
using Anthropic.SDK.Messaging;
using backend.Interfaces;

namespace backend.Services;

public class ClaudeService : IReviewAiService
{
    private readonly AnthropicClient client;
    private readonly string model;

    public ClaudeService(string apiKey)
    {
        client = new AnthropicClient(apiKey.Trim());
        model = Environment.GetEnvironmentVariable("AI_MODEL") ?? "claude-3-5-sonnet-latest";
    }

    public async Task<string> GenerateResponseAsync(string reviewText, string businessTone, string businessDesc)
    {
        var messages = new List<Message> 
        { 
            new Message(RoleType.User, $"Genera una respuesta para esta reseña: '{reviewText}'") 
        };

        var parameters = new MessageParameters
        {
            Messages = messages,
            Model = model,
            MaxTokens = 1000,
            Temperature = 0.7m,
            System = new List<SystemMessage> 
            { 
                new SystemMessage($"Eres un experto en reputación online para hostelería en Ferrol, Galicia. Negocio: {businessDesc}. Tono: {businessTone}. Responde de forma profesional y cercana, humana y personal.") 
            }
        };

        var response = await client.Messages.GetClaudeMessageAsync(parameters);
        
        return response.Content.FirstOrDefault()?.ToString() ?? "Lo siento, no pude generar una respuesta.";
    }
}