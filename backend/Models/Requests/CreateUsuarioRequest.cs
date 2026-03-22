namespace backend.Models.Requests;

public record CreateUsuarioRequest
{
    public string? Nombre { get; init; }
    public string? Telefono { get; init; }
}
