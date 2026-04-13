using backend.Interfaces;
using backend.Models.Entities;
using static Postgrest.Constants;

namespace backend.Repositories;

public class RadarAnalisisRepository : IRadarAnalisisRepository
{
    private readonly Supabase.Client _supabase;

    public RadarAnalisisRepository(Supabase.Client supabase) => _supabase = supabase;

    public async Task<List<RadarAnalisisEntity>> GetByNegocioIdOrderedAsync(Guid negocioId)
    {
        var result = await _supabase.From<RadarAnalisisEntity>()
            .Where(a => a.NegocioId == negocioId)
            .Order(a => a.CreatedAt, Ordering.Descending)
            .Get();
        return result.Models;
    }

    public async Task InsertAsync(RadarAnalisisEntity entity)
        => await _supabase.From<RadarAnalisisEntity>().Insert(entity);

    public async Task DeleteAsync(Guid id)
        => await _supabase.From<RadarAnalisisEntity>().Where(a => a.Id == id).Delete();
}
