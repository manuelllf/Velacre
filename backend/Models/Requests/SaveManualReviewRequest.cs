namespace backend.Models.Requests;

public record SaveManualReviewRequest
{
    public string ReviewText { get; init; } = "";
    public string TonoSeleccionado { get; init; } = "profesional"; // profesional | cercano | directo
    public string RespuestaProfesional { get; init; } = "";
    public string RespuestaCercano { get; init; } = "";
    public string RespuestaDirecto { get; init; } = "";
    public string Estado { get; init; } = "pendiente"; // pendiente | respondida
}
