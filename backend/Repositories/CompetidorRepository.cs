using backend.Interfaces;
using backend.Models.Entities;

namespace backend.Repositories;

public class CompetidorRepository : ICompetidorRepository
{
    private readonly Supabase.Client _supabase;

    public CompetidorRepository(Supabase.Client supabase) => _supabase = supabase;

    public async Task<List<CompetidorEntity>> GetByNegocioIdAsync(Guid negocioId)
    {
        var result = await _supabase.From<CompetidorEntity>().Where(c => c.NegocioId == negocioId).Get();
        return result.Models;
    }

    public async Task InsertAsync(CompetidorEntity entity)
        => await _supabase.From<CompetidorEntity>().Insert(entity);

    public async Task DeleteAsync(Guid id, Guid negocioId)
        => await _supabase.From<CompetidorEntity>().Where(c => c.Id == id && c.NegocioId == negocioId).Delete();
}
