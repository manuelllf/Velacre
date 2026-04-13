using backend.Interfaces;
using backend.Models.Entities;

namespace backend.Repositories;

public class GoogleConnectionRepository : IGoogleConnectionRepository
{
    private readonly Supabase.Client _supabase;

    public GoogleConnectionRepository(Supabase.Client supabase) => _supabase = supabase;

    public async Task<GoogleConnectionEntity?> GetByNegocioIdAsync(Guid negocioId)
    {
        var result = await _supabase.From<GoogleConnectionEntity>()
            .Where(c => c.NegocioId == negocioId).Limit(1).Get();
        return result.Models.FirstOrDefault();
    }

    public async Task<GoogleConnectionEntity?> GetActiveByNegocioIdAsync(Guid negocioId)
    {
        var result = await _supabase.From<GoogleConnectionEntity>()
            .Where(c => c.NegocioId == negocioId && c.IsActive == true).Limit(1).Get();
        return result.Models.FirstOrDefault();
    }

    public async Task InsertAsync(GoogleConnectionEntity entity)
        => await _supabase.From<GoogleConnectionEntity>().Insert(entity);

    public async Task UpdateAsync(GoogleConnectionEntity entity)
        => await _supabase.From<GoogleConnectionEntity>().Where(c => c.NegocioId == entity.NegocioId).Update(entity);

    public async Task DeleteByNegocioIdAsync(Guid negocioId)
        => await _supabase.From<GoogleConnectionEntity>().Where(c => c.NegocioId == negocioId).Delete();
}
