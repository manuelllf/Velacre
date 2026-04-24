using Postgrest.Attributes;
using Postgrest.Models;

namespace backend.Models.Entities;

[Table("negocio")]
public class NegocioEntity : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; }

    [Column("codigo")]
    public string Codigo { get; set; } = string.Empty;

    [Column("nombre")]
    public string Nombre { get; set; } = string.Empty;

    [Column("email")]
    public string? Email { get; set; }

    [Column("telefono")]
    public string? Telefono { get; set; }

    [Column("descripcion")]
    public string? Descripcion { get; set; }

    [Column("tonopredefinido")]
    public string TonoPredefinido { get; set; } = "Profesional";

    [Column("place_id")]
    public string? PlaceId { get; set; }

    [Column("idusuario")]
    public Guid? IdUsuario { get; set; }

    [Column("creadopor")]
    public Guid CreadoPor { get; set; }

    [Column("creadofecha")]
    public DateTimeOffset CreadoFecha { get; set; }

    [Column("actualizadopor")]
    public Guid? ActualizadoPor { get; set; }

    [Column("actualizadofecha")]
    public DateTimeOffset? ActualizadoFecha { get; set; }

    [Column("palabras_clave")]
    public string[]? PalabrasClave { get; set; }

    /// <summary>
    /// Ciclo de vida del negocio:
    ///   - "activo":              operativo y visible (default).
    ///   - "oculto_usuario":      borrado soft por el usuario. Preserva historial; si re-añade
    ///                            el mismo place_id le ofrecemos restaurar.
    ///   - "deshabilitado_plan":  el plan actual ya no cubre este slot (tras downgrade).
    ///                            Read-only hasta que vuelva a subir de plan.
    /// </summary>
    [Column("estado")]
    public string Estado { get; set; } = "activo";

    /// <summary>
    /// True si es el local "principal" del usuario. BD garantiza por índice único parcial
    /// que haya como máximo 1 principal por usuario. Al primer negocio de un usuario se le
    /// marca automáticamente (ver RPC try_create_negocio).
    /// </summary>
    [Column("es_principal")]
    public bool EsPrincipal { get; set; }
}
