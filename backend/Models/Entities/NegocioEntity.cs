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

    [Column("cif")]
    public string CIF { get; set; } = string.Empty;

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
}
