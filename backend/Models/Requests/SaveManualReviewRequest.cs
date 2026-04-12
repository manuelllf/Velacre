namespace backend.Models.Requests;

public record SaveManualReviewRequest
{
    public string ReviewText { get; init; } = "";
    public string TonoSeleccionado { get; init; } = "profesional"; // profesional | cercano | directo | empatico | humoristico
    public string Respuesta { get; init; } = "";
    public string Estado { get; init; } = "pendiente"; // pendiente | respondida
    public string? ContextoCliente { get; init; }
    public string? ContextoRespuesta { get; init; }
}
