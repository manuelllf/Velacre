using backend.Models.Requests;
using FluentValidation;

namespace backend.Validators;

public class GenerateReviewRequestValidator : AbstractValidator<GenerateReviewRequest>
{
    private static readonly string[] ValidTones =
        ["profesional", "cercano", "directo", "empatico", "empático", "agradecido", "humoristico", "humorístico"];

    public GenerateReviewRequestValidator()
    {
        RuleFor(x => x.ReviewText).NotEmpty().WithMessage("El texto de la reseña es obligatorio.");
        RuleFor(x => x.Tono)
            .Must(t => ValidTones.Contains(t, StringComparer.OrdinalIgnoreCase))
            .When(x => !string.IsNullOrEmpty(x.Tono))
            .WithMessage("Tono no válido.");
    }
}
