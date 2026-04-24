using backend.Models.Entities;

namespace backend.Interfaces;

public interface IUsuarioRepository
{
    Task<UsuarioEntity?> GetByIdAsync(Guid id);
    Task<List<UsuarioEntity>> GetAllAsync();
    Task InsertAsync(UsuarioEntity entity);
    Task UpdateAsync(UsuarioEntity entity);
    Task UpdateNombreAsync(Guid userId, string nombre);
    Task UpdateEstadoAsync(Guid userId, string estado, bool activo, DateTimeOffset? activoDesde, DateTimeOffset? pruebaHasta);
    Task UpdateProOverrideAsync(Guid userId, bool active, DateTimeOffset? hasta);
    Task UpdateNotasAsync(Guid userId, string? notas);
    Task UpdatePlanAsync(Guid userId, string plan);
    Task UpdateRolAsync(Guid userId, string rol);
    Task UpdateManualCounterAsync(Guid userId, int value, DateTimeOffset? reset);
    Task UpdateIaCounterRollbackAsync(Guid userId, int value);
    Task UpdateLsSubscriptionAsync(Guid userId, string plan, string? portalUrl, string? subscriptionId, string? lsStatus, DateTimeOffset? renewsAt, DateTimeOffset? endsAt);
    Task UpdateLsCancelAsync(Guid userId, string plan, string? lsStatus, DateTimeOffset? endsAt);
    Task AnonymizeAsync(Guid userId);
    Task<bool> TryIncrementIaCounterAsync(Guid userId, int limit);
    Task DeleteUserCascadeAsync(Guid userId);
    /// <summary>
    /// Incrementa inicios_sesion y actualiza ultimo_inicio_sesion. Para medir la
    /// métrica líder "dueños que vuelven" sin depender de MRR. Rate-limit ligero
    /// en el controller (1/hora por usuario).
    /// </summary>
    Task IncrementInicioSesionAsync(Guid userId, DateTimeOffset now);

    /// <summary>
    /// Actualiza el flag auto_pre_gen_ia (opt-in para pre-generación IA en cron).
    /// Basic ignora el flag en runtime; aquí solo persistimos la preferencia.
    /// </summary>
    Task UpdateAutoPreGenIaAsync(Guid userId, bool autoPreGenIa);
}
