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

    /// <summary>
    /// Genera 3 respuestas (Profesional, Cercano, Directo) con filtro de seguridad integrado.
    /// Si detecta contenido crítico devuelve Retenida=true y las respuestas vacías.
    /// </summary>
    Task<(string Profesional, string Cercano, string Directo, string ContextoCliente, string ContextoRespuesta, bool Retenida, string MotivoRetencion)> GenerateThreeResponsesWithSafeFilterAsync(
        string reviewText, string businessDesc);

    /// <summary>
    /// Genera un análisis comparativo de reputación frente a competidores.
    /// Devuelve JSON con tuFortaleza, tuDebilidad, competidores[], oportunidades[], accion.
    /// </summary>
    Task<string> GenerateRadarAnalysisAsync(
        string miNegocioNombre,
        List<string> misResenas,
        List<(string Nombre, List<string> Resenas)> competidores);

    /// <summary>
    /// Genera un análisis rápido para el mini-radar (admin/prospección).
    /// Devuelve JSON con fortalezas, debilidades, accion, resumen, emailPitch.
    /// </summary>
    Task<string> GenerateMiniRadarAnalysisAsync(string nombreNegocio, string resenasText,
        double ratingAvg, int pctRespondidas, int totalAnalizadas,
        DateTimeOffset fechaDesde, DateTimeOffset fechaHasta);
}
