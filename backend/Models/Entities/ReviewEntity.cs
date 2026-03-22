using Postgrest.Attributes;
using Postgrest.Models;

namespace backend.Models.Entities;

[Table("review")]
public class ReviewEntity : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; }

    [Column("codigo")]
    public string Codigo { get; set; } = string.Empty;

    [Column("idnegocio")]
    public Guid IdNegocio { get; set; }

    [Column("clientereview")]
    public string ClienteReview { get; set; } = string.Empty;

    [Column("respuestaprofesional")]
    public string? RespuestaProfesional { get; set; }

    [Column("respuestacolegueo")]
    public string? RespuestaColegueo { get; set; }

    [Column("respuestaorgullosa")]
    public string? RespuestaOrgullosa { get; set; }

    [Column("tono")]
    public string? Tono { get; set; }

    [Column("plataforma")]
    public string? Plataforma { get; set; }

    [Column("creadopor")]
    public Guid CreadoPor { get; set; }

    [Column("creadofecha")]
    public DateTimeOffset CreadoFecha { get; set; }

    [Column("actualizadopor")]
    public Guid? ActualizadoPor { get; set; }

    [Column("actualizadofecha")]
    public DateTimeOffset? ActualizadoFecha { get; set; }
}
