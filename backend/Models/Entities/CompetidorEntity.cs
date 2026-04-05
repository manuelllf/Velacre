using Postgrest.Attributes;
using Postgrest.Models;

namespace backend.Models.Entities;

[Table("competidor")]
public class CompetidorEntity : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; }

    [Column("negocio_id")]
    public Guid NegocioId { get; set; }

    [Column("place_id")]
    public string PlaceId { get; set; } = string.Empty;

    [Column("nombre")]
    public string Nombre { get; set; } = string.Empty;

    [Column("created_at")]
    public DateTimeOffset CreatedAt { get; set; }
}
