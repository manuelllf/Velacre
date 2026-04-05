namespace backend.Interfaces;

public interface IReviewAiService
{
    Task<(string Profesional, string Cercano, string Directo)> GenerateThreeResponsesAsync(
        string reviewText, string businessDesc);

    Task<string> GenerateSingleResponseAsync(string reviewText, string businessDesc, string tone);

    /// <summary>
    /// Genera la respuesta en el idioma de la reseña e incluye contexto en español en una sola llamada.
    /// Si detecta contenido crítico (intoxicación, maltrato, amenaza legal, datos sensibles) devuelve Retenida=true.
    /// </summary>
    Task<(string Response, string ContextoCliente, string ContextoRespuesta, string[] KeywordsUsadas, bool Retenida, string MotivoRetencion)> GenerateSingleResponseWithContextAsync(
        string reviewText, string businessDesc, string tone, string reviewLanguage, string[]? keywords = null);

    Task<string> GetClaudeMessageAsync(string userPrompt, string systemPrompt);
}
