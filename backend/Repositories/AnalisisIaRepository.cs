using backend.Interfaces;
using backend.Models.Entities;
using static Postgrest.Constants;

namespace backend.Repositories;

public class AnalisisIaRepository : IAnalisisIaRepository
{
    private readonly Supabase.Client _supabase;

    public AnalisisIaRepository(Supabase.Client supabase) => _supabase = supabase;

    public async Task<AnalisisIaEntity?> GetLatestByNegocioIdAsync(Guid negocioId)
    {
        var result = await _supabase.From<AnalisisIaEntity>()
            .Where(a => a.NegocioId == negocioId)
            .Order(a => a.CreatedAt!, Ordering.Descending)
            .Limit(1)
            .Get();
        return result.Models.FirstOrDefault();
    }

    public async Task<List<AnalisisIaEntity>> GetAllByNegocioIdAsync(Guid negocioId)
    {
        var result = await _supabase.From<AnalisisIaEntity>()
            .Where(a => a.NegocioId == negocioId)
            .Order(a => a.CreatedAt!, Ordering.Descending)
            .Get();
        return result.Models;
    }

    public async Task InsertAsync(AnalisisIaEntity entity)
        => await _supabase.From<AnalisisIaEntity>().Insert(entity);
}
