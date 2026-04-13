using backend.Models.Entities;

namespace backend.Interfaces;

public interface INegocioRepository
{
    Task<NegocioEntity?> GetByUserIdAsync(Guid userId);
    Task<NegocioEntity?> GetByIdAsync(Guid id);
    Task<NegocioEntity?> GetByIdAndUserIdAsync(Guid id, Guid userId);
    Task<List<NegocioEntity>> GetAllAsync();
    Task<List<NegocioEntity>> GetAllWithPlaceIdAsync();
    Task InsertAsync(NegocioEntity entity);
    Task UpdateAsync(NegocioEntity entity);
    Task DeleteByUserIdAsync(Guid userId);
}
