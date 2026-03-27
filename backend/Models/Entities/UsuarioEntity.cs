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

    /// <summary>Estado del usuario: "activo" | "baneado" | "prueba"</summary>
    [Column("estado")]
    public string Estado { get; set; } = "activo";

    /// <summary>Fecha de expiración del período de prueba (solo aplica si Estado == "prueba")</summary>
    [Column("prueba_hasta")]
    public DateTimeOffset? PruebaHasta { get; set; }

    /// <summary>Override manual de funciones Pro (Admin puede activar sin cambiar el plan)</summary>
    [Column("pro_override")]
    public bool ProOverride { get; set; } = false;

    /// <summary>Fecha de expiración del override Pro (null = sin caducidad)</summary>
    [Column("pro_override_hasta")]
    public DateTimeOffset? ProOverrideHasta { get; set; }

    /// <summary>Notas internas del admin (no visibles para el usuario)</summary>
    [Column("notas_admin")]
    public string? NotasAdmin { get; set; }

    /// <summary>Rol del usuario: "cliente" | "sales" | "admin"</summary>
    [Column("rol")]
    public string Rol { get; set; } = "cliente";

    /// <summary>URL del portal de cliente de Lemon Squeezy para gestionar la suscripción</summary>
    [Column("ls_customer_portal")]
    public string? LsCustomerPortal { get; set; }

    /// <summary>ID de la suscripción activa en Lemon Squeezy, necesario para cancelarla via API</summary>
    [Column("ls_subscription_id")]
    public string? LsSubscriptionId { get; set; }
}
