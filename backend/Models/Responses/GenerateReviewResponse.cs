namespace backend.Models.Responses;

public record GenerateReviewResponse(
    string Profesional,
    string Cercano,
    string Directo,
    Guid ReviewId,
    string Codigo
);
