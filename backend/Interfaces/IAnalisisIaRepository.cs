using backend.Models.Entities;

namespace backend.Interfaces;

public interface IAnalisisIaRepository
{
    Task<AnalisisIaEntity?> GetLatestByNegocioIdAsync(Guid negocioId);
    Task<List<AnalisisIaEntity>> GetAllByNegocioIdAsync(Guid negocioId);
    Task InsertAsync(AnalisisIaEntity entity);
}
