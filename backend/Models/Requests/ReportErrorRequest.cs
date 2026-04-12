namespace backend.Models.Requests;

/// <summary>
/// Payload que el frontend envía al endpoint /api/report-error cuando el usuario
/// pulsa "Reportar problema" tras ver un error real en la app.
/// No contiene stack traces — el objetivo es que info@velacre.com reciba el
/// contexto suficiente para reproducir sin filtrar internals.
/// </summary>
public class ReportErrorRequest
{
    public string? OccurredAt { get; set; }
    public string? Url { get; set; }
    public string? ErrorMessage { get; set; }
    public string? ErrorSource { get; set; }
    public int? StatusCode { get; set; }
    public string? Endpoint { get; set; }
    public string? LastAction { get; set; }
    public string? UserEmail { get; set; }
    public string? UserPlan { get; set; }
    public string? UserAgent { get; set; }
    public string? Platform { get; set; }
    public string? Language { get; set; }
    public string? Observaciones { get; set; }
    public string? ErrorId { get; set; }
}
