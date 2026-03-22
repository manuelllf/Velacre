namespace backend.Models.Requests;

public record GenerateReviewRequest
{
    public string ReviewText { get; init; } = "";
    public string? Plataforma { get; init; }
}
