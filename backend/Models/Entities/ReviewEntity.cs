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
    public string? RespuestaCercano { get; set; }

    [Column("respuestaorgullosa")]
    public string? RespuestaDirecto { get; set; }

    [Column("tono")]
    public string? Tono { get; set; }

    [Column("plataforma")]
    public string? Plataforma { get; set; }

    [Column("google_review_id")]
    public string? GoogleReviewId { get; set; }

    [Column("author_name")]
    public string? AuthorName { get; set; }

    [Column("star_rating")]
    public int? StarRating { get; set; }

    [Column("review_date")]
    public DateTimeOffset? ReviewDate { get; set; }

    [Column("tono_generado")]
    public string? TonoGenerado { get; set; }

    [Column("creadopor")]
    public Guid CreadoPor { get; set; }

    [Column("creadofecha")]
    public DateTimeOffset CreadoFecha { get; set; }

    [Column("actualizadopor")]
    public Guid? ActualizadoPor { get; set; }

    [Column("actualizadofecha")]
    public DateTimeOffset? ActualizadoFecha { get; set; }

    [Column("review_language")]
    public string? ReviewLanguage { get; set; }

    /// <summary>Estado de la reseña: "pendiente" | "respondida" | "ignorada"</summary>
    [Column("estado")]
    public string Estado { get; set; } = "pendiente";
}
