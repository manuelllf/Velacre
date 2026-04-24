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

    /// <summary>Respuestas IA generadas este mes (Core: límite 10, Pro: ilimitado)</summary>
    [Column("respuestas_ia_mes")]
    public int RespuestasIaMes { get; set; } = 0;

    [Column("respuestas_ia_mes_reset")]
    public DateTimeOffset? RespuestasIaMesReset { get; set; }

    /// <summary>Estado LS: active | cancelled | paused | past_due | expired</summary>
    [Column("ls_status")]
    public string? LsStatus { get; set; }

    /// <summary>Próxima fecha de renovación/cobro</summary>
    [Column("ls_renews_at")]
    public DateTimeOffset? LsRenewsAt { get; set; }

    /// <summary>Fecha en que expira el acceso (se rellena cuando se cancela)</summary>
    [Column("ls_ends_at")]
    public DateTimeOffset? LsEndsAt { get; set; }

    /// <summary>
    /// Número de locales contratados por el usuario. Base = 1. Cuando existan variants de volumen
    /// en LS (Pro+1, Pro+2…), el webhook subscription_updated lo actualiza. Para Pro sin variants
    /// de volumen, el backend bypasa el gate (ver try_create_negocio p_unlimited).
    /// </summary>
    [Column("locales_contratados")]
    public short LocalesContratados { get; set; } = 1;

    /// <summary>Contador acumulado de accesos a la app (dashboard/inicio/salud).</summary>
    [Column("inicios_sesion")]
    public int IniciosSesion { get; set; } = 0;

    /// <summary>Timestamp del último acceso registrado.</summary>
    [Column("ultimo_inicio_sesion")]
    public DateTimeOffset? UltimoInicioSesion { get; set; }
}
