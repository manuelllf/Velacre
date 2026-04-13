using backend.Interfaces;
using backend.Models.Entities;
using static Postgrest.Constants;

namespace backend.Repositories;

public class ReviewRepository : IReviewRepository
{
    private readonly Supabase.Client _supabase;

    public ReviewRepository(Supabase.Client supabase) => _supabase = supabase;

    public async Task<ReviewEntity?> GetByIdAndNegocioAsync(Guid reviewId, Guid negocioId)
    {
        var result = await _supabase.From<ReviewEntity>()
            .Where(r => r.Id == reviewId && r.IdNegocio == negocioId).Limit(1).Get();
        return result.Models.FirstOrDefault();
    }

    public async Task<ReviewEntity?> GetByIdAsync(Guid reviewId)
    {
        var result = await _supabase.From<ReviewEntity>().Where(r => r.Id == reviewId).Limit(1).Get();
        return result.Models.FirstOrDefault();
    }

    public async Task<List<ReviewEntity>> GetByNegocioIdAsync(Guid negocioId)
    {
        var result = await _supabase.From<ReviewEntity>().Where(r => r.IdNegocio == negocioId).Get();
        return result.Models;
    }

    public async Task<List<ReviewEntity>> GetByNegocioIdOrderedAsync(Guid negocioId, int limit)
    {
        var result = await _supabase.From<ReviewEntity>()
            .Where(r => r.IdNegocio == negocioId)
            .Order(r => r.CreadoFecha, Ordering.Descending)
            .Limit(limit)
            .Get();
        return result.Models;
    }

    public async Task InsertAsync(ReviewEntity entity)
        => await _supabase.From<ReviewEntity>().Insert(entity);

    public async Task UpdateAsync(ReviewEntity entity)
        => await _supabase.From<ReviewEntity>().Where(r => r.Id == entity.Id).Update(entity);

    public async Task DeleteByNegocioIdAsync(Guid negocioId)
        => await _supabase.From<ReviewEntity>().Where(r => r.IdNegocio == negocioId).Delete();

    public async Task<string[]> GetTopKeywordsAsync(Guid negocioId, int limit)
    {
        var rpcResult = await _supabase.Rpc("get_top_keywords",
            new Dictionary<string, object> { { "p_negocio_id", negocioId }, { "p_limit", limit } });
        var content = rpcResult?.Content ?? "[]";
        try
        {
            var doc = System.Text.Json.JsonDocument.Parse(content);
            return doc.RootElement.EnumerateArray()
                .Select(e => e.GetProperty("word").GetString() ?? "")
                .Where(w => !string.IsNullOrWhiteSpace(w))
                .ToArray();
        }
        catch
        {
            return [];
        }
    }
}
