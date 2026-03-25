using Postgrest.Attributes;
using Postgrest.Models;

namespace backend.Models.Entities;

/// <summary>
/// Liquidación mensual de comisión para un usuario con rol Sales.
/// El Admin la crea/edita y marca como pagada.
/// </summary>
[Table("liquidacion")]
public class LiquidacionEntity : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; }

    [Column("sales_id")]
    public Guid SalesId { get; set; }

    [Column("anio")]
    public int Anio { get; set; }

    [Column("mes")]
    public int Mes { get; set; }

    /// <summary>Ingresos brutos de los clientes asignados a este Sales en el mes</summary>
    [Column("ingresos_brutos")]
    public decimal IngresosBrutos { get; set; } = 0;

    /// <summary>Coste API (Claude + Outscraper) prorrateado para estos clientes</summary>
    [Column("costos_api")]
    public decimal CostosApi { get; set; } = 0;

    /// <summary>Fees de pasarela de pago (introducción manual hasta tener pasarela)</summary>
    [Column("fees_pasarela")]
    public decimal FeesPasarela { get; set; } = 0;

    /// <summary>Porcentaje de comisión del Sales (defecto 30)</summary>
    [Column("comision_pct")]
    public decimal ComisionPct { get; set; } = 30;

    [Column("pagado")]
    public bool Pagado { get; set; } = false;

    [Column("pagado_fecha")]
    public DateTimeOffset? PagadoFecha { get; set; }

    [Column("notas")]
    public string? Notas { get; set; }

    [Column("created_at")]
    public DateTimeOffset? CreatedAt { get; set; }
}
