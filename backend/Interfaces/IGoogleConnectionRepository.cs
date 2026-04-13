using backend.Models.Entities;

namespace backend.Interfaces;

public interface IGoogleConnectionRepository
{
    Task<GoogleConnectionEntity?> GetByNegocioIdAsync(Guid negocioId);
    Task<GoogleConnectionEntity?> GetActiveByNegocioIdAsync(Guid negocioId);
    Task InsertAsync(GoogleConnectionEntity entity);
    Task UpdateAsync(GoogleConnectionEntity entity);
    Task DeleteByNegocioIdAsync(Guid negocioId);
}
