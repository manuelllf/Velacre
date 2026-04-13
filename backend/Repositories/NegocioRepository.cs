using backend.Interfaces;
using backend.Models.Entities;

namespace backend.Repositories;

public class NegocioRepository : INegocioRepository
{
    private readonly Supabase.Client _supabase;

    public NegocioRepository(Supabase.Client supabase) => _supabase = supabase;

    public async Task<NegocioEntity?> GetByUserIdAsync(Guid userId)
    {
        var result = await _supabase.From<NegocioEntity>().Where(n => n.IdUsuario == userId).Limit(1).Get();
        return result.Models.FirstOrDefault();
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

    public async Task<List<NegocioEntity>> GetAllAsync()
    {
        var result = await _supabase.From<NegocioEntity>().Get();
        return result.Models;
    }

    public async Task<List<NegocioEntity>> GetAllWithPlaceIdAsync()
    {
        var all = await GetAllAsync();
        return all.Where(n => !string.IsNullOrEmpty(n.PlaceId)).ToList();
    }

    public async Task InsertAsync(NegocioEntity entity)
        => await _supabase.From<NegocioEntity>().Insert(entity);

    public async Task UpdateAsync(NegocioEntity entity)
        => await _supabase.From<NegocioEntity>().Where(n => n.Id == entity.Id).Update(entity);

    public async Task DeleteByUserIdAsync(Guid userId)
        => await _supabase.From<NegocioEntity>().Where(n => n.IdUsuario == userId).Delete();
}
