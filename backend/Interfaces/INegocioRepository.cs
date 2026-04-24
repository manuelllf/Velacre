using backend.Models.Entities;

namespace backend.Interfaces;

public interface INegocioRepository
{
    /// <summary>
    /// Negocio "primario" del usuario. Prefiere es_principal=TRUE; fallback al más antiguo activo.
    /// Solo considera estado='activo'.
    /// </summary>
    Task<NegocioEntity?> GetByUserIdAsync(Guid userId);
    /// <summary>Lista solo negocios activos del usuario, ordenados ASC.</summary>
    Task<List<NegocioEntity>> GetAllByUserIdAsync(Guid userId);
    /// <summary>Lista negocios del usuario. Si includeHidden=true, incluye ocultos y deshabilitados.</summary>
    Task<List<NegocioEntity>> GetAllByUserIdAsync(Guid userId, bool includeHidden);
    Task<NegocioEntity?> GetByIdAsync(Guid id);
    Task<NegocioEntity?> GetByIdAndUserIdAsync(Guid id, Guid userId);
    /// <summary>Busca un negocio oculto con ese place_id — usado para ofrecer restore al re-crear.</summary>
    Task<NegocioEntity?> GetHiddenByPlaceIdAsync(Guid userId, string placeId);
    Task<List<NegocioEntity>> GetAllAsync();
    Task<List<NegocioEntity>> GetAllWithPlaceIdAsync();
    Task InsertAsync(NegocioEntity entity);
    Task UpdateAsync(NegocioEntity entity);
    Task DeleteByUserIdAsync(Guid userId);
    /// <summary>Borrado físico — reservado para cascada de cuenta. Para UI usar SoftDeleteAsync.</summary>
    Task DeleteByIdAsync(Guid id);
    /// <summary>Soft delete: marca estado='oculto_usuario', preserva historial para posible restore.</summary>
    Task SoftDeleteAsync(Guid id);
    /// <summary>Restaura un negocio oculto → estado='activo'.</summary>
    Task RestoreAsync(Guid id);
    /// <summary>Cuenta solo los activos (los que ocupan slot).</summary>
    Task<int> CountByUserIdAsync(Guid userId);
    /// <summary>Cambia el principal transaccionalmente via RPC set_negocio_principal.</summary>
    Task SetPrincipalAsync(Guid userId, Guid negocioId);

    /// <summary>
    /// Crea un negocio atómicamente validando slots disponibles vía RPC.
    /// Lanza <see cref="SlotLimitReachedException"/> si el usuario ha alcanzado su tope.
    /// </summary>
    /// <param name="unlimited">Si true, bypasa el gate (usado para Pro hasta que existan variants de volumen).</param>
    Task<Guid> TryCreateAsync(
        Guid userId,
        string codigo,
        string nombre,
        string? email,
        string? telefono,
        string? descripcion,
        string tono,
        string[]? palabrasClave,
        bool unlimited);
}

public class SlotLimitReachedException : Exception
{
    public SlotLimitReachedException(string message) : base(message) { }
}
