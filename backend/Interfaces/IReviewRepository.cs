using backend.Models.Entities;

namespace backend.Interfaces;

public interface IReviewRepository
{
    Task<ReviewEntity?> GetByIdAndNegocioAsync(Guid reviewId, Guid negocioId);
    Task<ReviewEntity?> GetByIdAsync(Guid reviewId);
    Task<List<ReviewEntity>> GetByNegocioIdAsync(Guid negocioId);
    Task<List<ReviewEntity>> GetByNegocioIdOrderedAsync(Guid negocioId, int limit);
    Task InsertAsync(ReviewEntity entity);
    Task UpdateAsync(ReviewEntity entity);
    Task DeleteByNegocioIdAsync(Guid negocioId);
    Task<string[]> GetTopKeywordsAsync(Guid negocioId, int limit);
}
