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
        // Limpiamos la clave y configuramos el cliente
        _client = new AnthropicClient(apiKey.Trim());
        _model = Environment.GetEnvironmentVariable("AI_MODEL") ?? "claude-3-5-sonnet-latest";
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
            Model = _model,
            MaxTokens = 1000,
            Temperature = 0.7m,
            // CORRECCIÓN CS0029: System ahora espera una List<SystemMessage>
            System = new List<SystemMessage> 
            { 
                new SystemMessage($"Eres un experto en reputación online para hostelería en Ferrol, Galicia. Negocio: {businessDesc}. Tono: {businessTone}. Responde de forma profesional y cercana.") 
            }
        };

        // CORRECCIÓN: El método correcto en la v5.10.0 es GetMessagesAsync
        var response = await _client.Messages.GetClaudeMessageAsync(parameters);
        
        // Extraemos el texto del primer bloque de contenido
        return response.Content.FirstOrDefault()?.ToString() ?? "Lo siento, no pude generar una respuesta.";
    }
}