using Postgrest.Attributes;
using Postgrest.Models;

namespace backend.Models.Entities;

/// <summary>
/// Registro de costes reales de API por usuario y mes.
/// El admin actualiza estos valores a mes vencido.
/// </summary>
[Table("costos_mes")]
public class CostoMesEntity : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; }

    [Column("usuario_id")]
    public Guid UsuarioId { get; set; }

    [Column("anio")]
    public int Anio { get; set; }

    [Column("mes")]
    public int Mes { get; set; }

    /// <summary>Coste real de Claude AI en EUR para este usuario/mes</summary>
    [Column("costo_claude_eur")]
    public decimal CostoClaudeEur { get; set; } = 0;

    /// <summary>Créditos reales de Outscraper consumidos en EUR para este usuario/mes</summary>
    [Column("costo_outscraper_eur")]
    public decimal CostoOutscraperEur { get; set; } = 0;

    /// <summary>Notas del admin sobre este mes (incidencias, uso inusual, etc.)</summary>
    [Column("notas")]
    public string? Notas { get; set; }

    [Column("updated_at")]
    public DateTimeOffset? UpdatedAt { get; set; }
}
