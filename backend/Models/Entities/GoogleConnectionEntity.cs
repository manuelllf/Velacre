using Postgrest.Attributes;
using Postgrest.Models;

namespace backend.Models.Entities;

[Table("google_connection")]
public class GoogleConnectionEntity : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; }

    [Column("negocio_id")]
    public Guid NegocioId { get; set; }

    /// <summary>Resource name de la cuenta GBP — "accounts/123456789"</summary>
    [Column("google_account_id")]
    public string GoogleAccountId { get; set; } = string.Empty;

    /// <summary>Resource name del local GBP — "accounts/123456789/locations/987654321"</summary>
    [Column("location_name")]
    public string LocationName { get; set; } = string.Empty;

    /// <summary>Nombre legible del local tal como aparece en Google</summary>
    [Column("display_name")]
    public string? DisplayName { get; set; }

    [Column("access_token")]
    public string AccessToken { get; set; } = string.Empty;

    [Column("refresh_token")]
    public string RefreshToken { get; set; } = string.Empty;

    [Column("token_expiry")]
    public DateTimeOffset TokenExpiry { get; set; }

    [Column("connected_at")]
    public DateTimeOffset ConnectedAt { get; set; }

    /// <summary>False mientras el usuario no ha seleccionado su local (flujo pendiente de selección)</summary>
    [Column("is_active")]
    public bool IsActive { get; set; }
}
