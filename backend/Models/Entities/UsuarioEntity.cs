using Postgrest.Attributes;
using Postgrest.Models;

namespace backend.Models.Entities;

[Table("usuario")]
public class UsuarioEntity : BaseModel
{
    [PrimaryKey("id", true)]
    public Guid Id { get; set; }

    [Column("nombre")]
    public string? Nombre { get; set; }

    [Column("telefono")]
    public string? Telefono { get; set; }

    [Column("creadopor")]
    public Guid CreadoPor { get; set; }

    [Column("creadofecha")]
    public DateTimeOffset CreadoFecha { get; set; }

    [Column("actualizadopor")]
    public Guid? ActualizadoPor { get; set; }

    [Column("actualizadofecha")]
    public DateTimeOffset? ActualizadoFecha { get; set; }

    [Column("activo")]
    public bool Activo { get; set; }

    [Column("activo_desde")]
    public DateTimeOffset? ActivoDesde { get; set; }

    [Column("email")]
    public string? Email { get; set; }

    [Column("plan")]
    public string Plan { get; set; } = "basic";

    [Column("respuestas_manuales_mes")]
    public int RespuestasManualesMes { get; set; } = 0;

    [Column("respuestas_mes_reset")]
    public DateTimeOffset? RespuestasMesReset { get; set; }
}
