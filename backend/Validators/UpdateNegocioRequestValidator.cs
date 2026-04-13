using backend.Models.Requests;
using FluentValidation;

namespace backend.Validators;

public class UpdateNegocioRequestValidator : AbstractValidator<UpdateNegocioRequest>
{
    private static readonly string[] ValidTones =
        ["Profesional", "Cercano", "Directo", "Empatico", "Empático", "Agradecido", "Humoristico", "Humorístico"];

    public UpdateNegocioRequestValidator()
    {
        RuleFor(x => x.Nombre).MaximumLength(200).When(x => x.Nombre != null);
        RuleFor(x => x.TonoPredefinido)
            .Must(t => ValidTones.Contains(t, StringComparer.OrdinalIgnoreCase))
            .When(x => x.TonoPredefinido != null)
            .WithMessage("Tono no válido.");
        RuleFor(x => x.PalabrasClave)
            .Must(k => k!.Length <= 5)
            .When(x => x.PalabrasClave != null)
            .WithMessage("Máximo 5 palabras clave.");
        RuleForEach(x => x.PalabrasClave)
            .MaximumLength(50)
            .When(x => x.PalabrasClave != null);
    }
}
