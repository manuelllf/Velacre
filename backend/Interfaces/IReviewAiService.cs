namespace backend.Interfaces;

public interface IReviewAiService
{
    Task<(string Profesional, string Colegueo, string Orgullosa)> GenerateThreeResponsesAsync(
        string reviewText, string businessDesc);
}
