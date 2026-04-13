using backend.Models.Requests;
using FluentValidation;

namespace backend.Validators;

public class SaveManualReviewRequestValidator : AbstractValidator<SaveManualReviewRequest>
{
    private static readonly string[] ValidTones =
        ["profesional", "cercano", "directo", "empatico", "empático", "agradecido", "humoristico", "humorístico"];

    public SaveManualReviewRequestValidator()
    {
        RuleFor(x => x.ReviewText).NotEmpty().WithMessage("El texto de la reseña es obligatorio.");
        RuleFor(x => x.Respuesta).NotEmpty().WithMessage("La respuesta es obligatoria.");
        RuleFor(x => x.TonoSeleccionado)
            .Must(t => ValidTones.Contains(t, StringComparer.OrdinalIgnoreCase))
            .WithMessage("Tono no válido.");
        RuleFor(x => x.Estado)
            .Must(e => e is "pendiente" or "respondida")
            .WithMessage("Estado debe ser 'pendiente' o 'respondida'.");
    }
}
