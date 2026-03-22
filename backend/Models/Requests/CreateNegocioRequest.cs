namespace backend.Models.Requests;

public record CreateNegocioRequest
{
    public string CIF { get; init; } = "";
    public string Nombre { get; init; } = "";
    public string? Email { get; init; }
    public string? Telefono { get; init; }
    public string? Descripcion { get; init; }
    public string? TonoPredefinido { get; init; }
}
