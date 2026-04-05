using Postgrest.Attributes;
using Postgrest.Models;

namespace backend.Models.Entities;

[Table("radar_analisis")]
public class RadarAnalisisEntity : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; }

    [Column("negocio_id")]
    public Guid NegocioId { get; set; }

    /// <summary>JSON con el análisis completo generado por Claude</summary>
    [Column("resultado_json")]
    public string ResultadoJson { get; set; } = string.Empty;

    [Column("created_at")]
    public DateTimeOffset CreatedAt { get; set; }
}
