using backend.Models.Entities;

namespace backend.Interfaces;

public interface ICompetidorRepository
{
    Task<List<CompetidorEntity>> GetByNegocioIdAsync(Guid negocioId);
    Task InsertAsync(CompetidorEntity entity);
    Task DeleteAsync(Guid id, Guid negocioId);
}
