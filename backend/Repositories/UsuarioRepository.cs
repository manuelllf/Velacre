using backend.Interfaces;
using backend.Models.Entities;

namespace backend.Repositories;

public class UsuarioRepository : IUsuarioRepository
{
    private readonly Supabase.Client _supabase;

    public UsuarioRepository(Supabase.Client supabase) => _supabase = supabase;

    public async Task<UsuarioEntity?> GetByIdAsync(Guid id)
    {
        var result = await _supabase.From<UsuarioEntity>().Where(u => u.Id == id).Limit(1).Get();
        return result.Models.FirstOrDefault();
    }

    public async Task<List<UsuarioEntity>> GetAllAsync()
    {
        var result = await _supabase.From<UsuarioEntity>().Get();
        return result.Models;
    }

    public async Task InsertAsync(UsuarioEntity entity)
        => await _supabase.From<UsuarioEntity>().Insert(entity);

    public async Task UpdateAsync(UsuarioEntity entity)
        => await _supabase.From<UsuarioEntity>().Where(u => u.Id == entity.Id).Update(entity);

    public async Task UpdateNombreAsync(Guid userId, string nombre)
        => await _supabase.From<UsuarioEntity>().Where(u => u.Id == userId)
            .Set(u => u.Nombre!, nombre)
            .Update();

    public async Task UpdateEstadoAsync(Guid userId, string estado, bool activo, DateTimeOffset? activoDesde, DateTimeOffset? pruebaHasta)
        => await _supabase.From<UsuarioEntity>().Where(u => u.Id == userId)
            .Set(u => u.Estado, estado)
            .Set(u => u.Activo, activo)
            .Set(u => u.ActivoDesde, activoDesde)
            .Set(u => u.PruebaHasta, pruebaHasta)
            .Update();

    public async Task UpdateProOverrideAsync(Guid userId, bool active, DateTimeOffset? hasta)
        => await _supabase.From<UsuarioEntity>().Where(u => u.Id == userId)
            .Set(u => u.ProOverride, active)
            .Set(u => u.ProOverrideHasta, hasta)
            .Update();

    public async Task UpdateNotasAsync(Guid userId, string? notas)
        => await _supabase.From<UsuarioEntity>().Where(u => u.Id == userId)
            .Set(u => u.NotasAdmin, notas)
            .Update();

    public async Task UpdatePlanAsync(Guid userId, string plan)
        => await _supabase.From<UsuarioEntity>().Where(u => u.Id == userId)
            .Set(u => u.Plan, plan)
            .Update();

    public async Task UpdateRolAsync(Guid userId, string rol)
        => await _supabase.From<UsuarioEntity>().Where(u => u.Id == userId)
            .Set(u => u.Rol, rol)
            .Update();

    public async Task UpdateManualCounterAsync(Guid userId, int value, DateTimeOffset? reset)
        => await _supabase.From<UsuarioEntity>().Where(u => u.Id == userId)
            .Set(u => u.RespuestasManualesMes, value)
            .Set(u => u.RespuestasMesReset, reset)
            .Update();

    public async Task UpdateIaCounterRollbackAsync(Guid userId, int value)
        => await _supabase.From<UsuarioEntity>().Where(u => u.Id == userId)
            .Set(u => u.RespuestasIaMes, value)
            .Update();

    public async Task IncrementInicioSesionAsync(Guid userId, DateTimeOffset now)
    {
        // Postgrest no soporta SQL raw increment, así que leemos y escribimos.
        // Volumen esperado ≤ 1/hora/user (rate-limit en controller) → contención irrelevante.
        var user = await GetByIdAsync(userId);
        if (user == null) return;
        await _supabase.From<UsuarioEntity>().Where(u => u.Id == userId)
            .Set(u => u.IniciosSesion, user.IniciosSesion + 1)
            .Set(u => u.UltimoInicioSesion, now)
            .Update();
    }

    public async Task UpdateAutoPreGenIaAsync(Guid userId, bool autoPreGenIa)
        => await _supabase.From<UsuarioEntity>().Where(u => u.Id == userId)
            .Set(u => u.AutoPreGenIa, autoPreGenIa)
            .Update();

    public async Task UpdateLsSubscriptionAsync(Guid userId, string plan, string? portalUrl, string? subscriptionId, string? lsStatus, DateTimeOffset? renewsAt, DateTimeOffset? endsAt)
        => await _supabase.From<UsuarioEntity>().Where(u => u.Id == userId)
            .Set(u => u.Plan, plan)
            .Set(u => u.LsCustomerPortal, portalUrl)
            .Set(u => u.LsSubscriptionId, subscriptionId)
            .Set(u => u.LsStatus, lsStatus)
            .Set(u => u.LsRenewsAt, renewsAt)
            .Set(u => u.LsEndsAt, endsAt)
            .Update();

    public async Task UpdateLsCancelAsync(Guid userId, string plan, string? lsStatus, DateTimeOffset? endsAt)
        => await _supabase.From<UsuarioEntity>().Where(u => u.Id == userId)
            .Set(u => u.Plan, plan)
            .Set(u => u.LsStatus, lsStatus)
            .Set(u => u.LsEndsAt, endsAt)
            .Update();

    public async Task AnonymizeAsync(Guid userId)
        => await _supabase.From<UsuarioEntity>().Where(u => u.Id == userId)
            .Set(u => u.Email, $"deleted-{userId}@velacre.com")
            .Set(u => u.Nombre!, "Usuario eliminado")
            .Set(u => u.Activo, false)
            .Set(u => u.Estado, "eliminado")
            .Update();

    public async Task<bool> TryIncrementIaCounterAsync(Guid userId, int limit)
    {
        var rpcResult = await _supabase.Rpc("try_increment_ia_counter",
            new Dictionary<string, object> { { "p_user_id", userId }, { "p_limit", limit } });
        var content = rpcResult?.Content?.Trim().Trim('"') ?? "";
        return content.Equals("true", StringComparison.OrdinalIgnoreCase);
    }

    public async Task DeleteUserCascadeAsync(Guid userId)
        => await _supabase.Rpc("delete_user_cascade",
            new Dictionary<string, object> { { "p_user_id", userId } });
}
