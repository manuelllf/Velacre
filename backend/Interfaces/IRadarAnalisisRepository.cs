using backend.Models.Entities;

namespace backend.Interfaces;

public interface IRadarAnalisisRepository
{
    Task<List<RadarAnalisisEntity>> GetByNegocioIdOrderedAsync(Guid negocioId);
    Task InsertAsync(RadarAnalisisEntity entity);
    Task DeleteAsync(Guid id);
}
