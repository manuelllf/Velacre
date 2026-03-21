namespace backend.Interfaces;

public interface IReviewAiService {
    Task<string> GenerateResponseAsync(string reviewText, string businessTone, string businessDesc);
}
