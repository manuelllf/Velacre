using Postgrest.Attributes;
using Postgrest.Models;

namespace backend.Models.Entities;

/// <summary>
/// Coste real total de APIs por mes (plataforma completa, no por usuario).
/// El admin lo rellena a mes vencido con la factura de Anthropic + Outscraper.
/// </summary>
[Table("costos_mes")]
public class CostoMesEntity : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; }

    [Column("anio")]
    public int Anio { get; set; }

    [Column("mes")]
    public int Mes { get; set; }

    [Column("costo_claude_eur")]
    public decimal CostoClaudeEur { get; set; } = 0;

    [Column("costo_outscraper_eur")]
    public decimal CostoOutscraperEur { get; set; } = 0;

    [Column("notas")]
    public string? Notas { get; set; }

    [Column("updated_at")]
    public DateTimeOffset? UpdatedAt { get; set; }
}
