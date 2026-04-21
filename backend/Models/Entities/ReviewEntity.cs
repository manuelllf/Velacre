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

    /// <summary>
    /// Respuesta del propietario (generada por IA o importada desde Google).
    /// La identidad del tono se guarda en <see cref="TonoGenerado"/>, no en el nombre de la columna.
    /// </summary>
    [Column("respuesta")]
    public string? Respuesta { get; set; }

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

    /// <summary>Timestamp en que el usuario marcó la reseña como respondida (publicada en Google)</summary>
    [Column("respondida_fecha")]
    public DateTimeOffset? RespondidaFecha { get; set; }

    [Column("keywords_usadas")]
    public string[]? KeywordsUsadas { get; set; }

    [Column("contexto_cliente")]
    public string? ContextoCliente { get; set; }

    [Column("contexto_respuesta")]
    public string? ContextoRespuesta { get; set; }

    /// <summary>Versión de la respuesta que se publicó en Google (puede ser editada respecto a la generada por IA)</summary>
    [Column("respuesta_publicada")]
    public string? RespuestaPublicada { get; set; }

    /// <summary>True si la respuesta fue publicada directamente en Google desde Velacre</summary>
    [Column("publicada_en_google")]
    public bool PublicadaEnGoogle { get; set; }

    /// <summary>Timestamp en que se publicó la respuesta en Google</summary>
    [Column("publicada_fecha")]
    public DateTimeOffset? PublicadaFecha { get; set; }

    /// <summary>True si la IA detectó contenido crítico y retuvo la generación para revisión manual</summary>
    [Column("retenida")]
    public bool Retenida { get; set; }

    /// <summary>Motivo por el que la reseña fue retenida: intoxicacion | maltrato | amenaza_legal | datos_personales</summary>
    [Column("motivo_retencion")]
    public string? MotivoRetencion { get; set; }
}
