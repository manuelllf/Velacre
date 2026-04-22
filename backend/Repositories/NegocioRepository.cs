using backend.Interfaces;
using backend.Models.Entities;
using static Postgrest.Constants;

namespace backend.Repositories;

public class NegocioRepository : INegocioRepository
{
    private const string EstadoActivo          = "activo";
    private const string EstadoOcultoUsuario   = "oculto_usuario";
    private const string EstadoDeshabilitadoPlan = "deshabilitado_plan";

    private readonly Supabase.Client _supabase;

    public NegocioRepository(Supabase.Client supabase) => _supabase = supabase;

    /// <summary>
    /// Devuelve el negocio "primario" del usuario:
    ///   1. El que tenga es_principal=TRUE (solo puede haber 1, garantizado por BD).
    ///   2. Fallback: el más antiguo activo.
    /// Solo considera estado='activo' (los ocultos/deshabilitados no son candidatos).
    /// </summary>
    public async Task<NegocioEntity?> GetByUserIdAsync(Guid userId)
    {
        var principal = await _supabase.From<NegocioEntity>()
            .Where(n => n.IdUsuario == userId && n.EsPrincipal == true && n.Estado == EstadoActivo)
            .Limit(1).Get();
        var found = principal.Models.FirstOrDefault();
        if (found != null) return found;

        var fallback = await _supabase.From<NegocioEntity>()
            .Where(n => n.IdUsuario == userId && n.Estado == EstadoActivo)
            .Order(n => n.CreadoFecha, Ordering.Ascending)
            .Limit(1).Get();
        return fallback.Models.FirstOrDefault();
    }

    /// <summary>Lista todos los negocios ACTIVOS del usuario, ordenados por creación ASC.</summary>
    public async Task<List<NegocioEntity>> GetAllByUserIdAsync(Guid userId)
        => await GetAllByUserIdAsync(userId, includeHidden: false);

    /// <param name="includeHidden">Si true, incluye ocultos y deshabilitados (para UI de restore).</param>
    public async Task<List<NegocioEntity>> GetAllByUserIdAsync(Guid userId, bool includeHidden)
    {
        var query = _supabase.From<NegocioEntity>().Where(n => n.IdUsuario == userId);
        if (!includeHidden)
            query = query.Where(n => n.Estado == EstadoActivo);

        var result = await query.Order(n => n.CreadoFecha, Ordering.Ascending).Get();
        return result.Models;
    }

    public async Task<NegocioEntity?> GetByIdAsync(Guid id)
    {
        var result = await _supabase.From<NegocioEntity>().Where(n => n.Id == id).Limit(1).Get();
        return result.Models.FirstOrDefault();
    }

    public async Task<NegocioEntity?> GetByIdAndUserIdAsync(Guid id, Guid userId)
    {
        var result = await _supabase.From<NegocioEntity>().Where(n => n.Id == id && n.IdUsuario == userId).Limit(1).Get();
        return result.Models.FirstOrDefault();
    }

    /// <summary>
    /// Busca un negocio del usuario con ese place_id que esté OCULTO (soft-deleted).
    /// Se usa al crear un nuevo local: si el usuario ya tuvo ese place_id antes,
    /// le ofrecemos restaurar en vez de crear uno nuevo (preserva historial de reseñas).
    /// </summary>
    public async Task<NegocioEntity?> GetHiddenByPlaceIdAsync(Guid userId, string placeId)
    {
        var result = await _supabase.From<NegocioEntity>()
            .Where(n => n.IdUsuario == userId && n.PlaceId == placeId && n.Estado == EstadoOcultoUsuario)
            .Limit(1).Get();
        return result.Models.FirstOrDefault();
    }

    public async Task<List<NegocioEntity>> GetAllAsync()
    {
        var result = await _supabase.From<NegocioEntity>().Get();
        return result.Models;
    }

    public async Task<List<NegocioEntity>> GetAllWithPlaceIdAsync()
    {
        // Solo activos: no queremos sync de reseñas sobre locales ocultos/deshabilitados.
        var all = await _supabase.From<NegocioEntity>()
            .Where(n => n.Estado == EstadoActivo)
            .Get();
        return all.Models.Where(n => !string.IsNullOrEmpty(n.PlaceId)).ToList();
    }

    public async Task InsertAsync(NegocioEntity entity)
        => await _supabase.From<NegocioEntity>().Insert(entity);

    public async Task UpdateAsync(NegocioEntity entity)
        => await _supabase.From<NegocioEntity>().Where(n => n.Id == entity.Id).Update(entity);

    public async Task DeleteByUserIdAsync(Guid userId)
        => await _supabase.From<NegocioEntity>().Where(n => n.IdUsuario == userId).Delete();

    public async Task DeleteByIdAsync(Guid id)
        => await _supabase.From<NegocioEntity>().Where(n => n.Id == id).Delete();

    /// <summary>Soft delete: marca estado='oculto_usuario' preservando historial.</summary>
    public async Task SoftDeleteAsync(Guid id)
    {
        await _supabase.From<NegocioEntity>().Where(n => n.Id == id)
            .Set(n => n.Estado, EstadoOcultoUsuario)
            .Set(n => n.EsPrincipal, false)
            .Update();
    }

    /// <summary>Reactiva un negocio oculto. El llamante debe haber validado que cabe un slot.</summary>
    public async Task RestoreAsync(Guid id)
    {
        await _supabase.From<NegocioEntity>().Where(n => n.Id == id)
            .Set(n => n.Estado, EstadoActivo)
            .Update();
    }

    public async Task<int> CountByUserIdAsync(Guid userId)
    {
        // Solo cuenta activos — los ocultos/deshabilitados no ocupan slot.
        var result = await _supabase.From<NegocioEntity>()
            .Where(n => n.IdUsuario == userId && n.Estado == EstadoActivo)
            .Get();
        return result.Models.Count;
    }

    /// <summary>Cambia el principal via RPC transaccional (unset anterior + set nuevo).</summary>
    public async Task SetPrincipalAsync(Guid userId, Guid negocioId)
    {
        await _supabase.Rpc("set_negocio_principal", new Dictionary<string, object?>
        {
            ["p_user_id"]    = userId,
            ["p_negocio_id"] = negocioId,
        });
    }

    public async Task<Guid> TryCreateAsync(
        Guid userId,
        string codigo,
        string nombre,
        string? email,
        string? telefono,
        string? descripcion,
        string tono,
        string[]? palabrasClave,
        bool unlimited)
    {
        try
        {
            var rpc = await _supabase.Rpc("try_create_negocio", new Dictionary<string, object?>
            {
                ["p_user_id"]        = userId,
                ["p_codigo"]         = codigo,
                ["p_nombre"]         = nombre,
                ["p_email"]          = email,
                ["p_telefono"]       = telefono,
                ["p_descripcion"]    = descripcion,
                ["p_tono"]           = tono,
                ["p_palabras_clave"] = palabrasClave ?? Array.Empty<string>(),
                ["p_unlimited"]      = unlimited,
            });
            var content = rpc?.Content?.Trim().Trim('"') ?? "";
            return Guid.Parse(content);
        }
        catch (Exception ex) when (ex.Message.Contains("slot_limit_reached", StringComparison.OrdinalIgnoreCase))
        {
            throw new SlotLimitReachedException(ex.Message);
        }
    }
}
