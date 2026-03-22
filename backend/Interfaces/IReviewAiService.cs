namespace backend.Interfaces;

public interface IReviewAiService
{
    Task<(string Profesional, string Colegueo, string Orgullosa)> GenerateThreeResponsesAsync(
        string reviewText, string businessDesc);

    Task<string> GenerateSingleResponseAsync(string reviewText, string businessDesc, string tone);
}
