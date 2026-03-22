namespace backend.Models.Requests;

public record UpdateNegocioRequest
{
    public string? Nombre { get; init; }
    public string? Email { get; init; }
    public string? Telefono { get; init; }
    public string? Descripcion { get; init; }
    public string? TonoPredefinido { get; init; }
    public string? PlaceId { get; init; }
}
