namespace backend.Models.Responses;

public record GenerateReviewResponse(
    string Profesional,
    string Colegueo,
    string Orgullosa,
    Guid ReviewId,
    string Codigo
);
