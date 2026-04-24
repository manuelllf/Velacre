namespace backend.Models.Requests;

public record CreateNegocioRequest
{
    public string Nombre { get; init; } = "";
    public string? Email { get; init; }
    public string? Telefono { get; init; }
    public string? Descripcion { get; init; }
    public string? TonoPredefinido { get; init; }
    public string[]? PalabrasClave { get; init; }

    /// <summary>
    /// Opcional. Si se pasa y coincide con un place_id que el usuario ya tuvo oculto,
    /// el backend devuelve 409 existe_oculto con el id, para que el frontend ofrezca restaurar.
    /// </summary>
    public string? PlaceId { get; init; }
}
