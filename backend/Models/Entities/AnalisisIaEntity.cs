using Postgrest.Attributes;
using Postgrest.Models;

namespace backend.Models.Entities;

[Table("analisis_ia")]
public class AnalisisIaEntity : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; }

    [Column("negocio_id")]
    public Guid NegocioId { get; set; }

    [Column("brilla")]
    public string Brilla { get; set; } = string.Empty;

    [Column("quema")]
    public string Quema { get; set; } = string.Empty;

    [Column("accion")]
    public string Accion { get; set; } = string.Empty;

    [Column("review_count")]
    public int ReviewCount { get; set; }

    [Column("created_at")]
    public DateTimeOffset? CreatedAt { get; set; }
}
