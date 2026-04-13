using backend.Models.Requests;
using FluentValidation;

namespace backend.Validators;

public class CreateUsuarioRequestValidator : AbstractValidator<CreateUsuarioRequest>
{
    public CreateUsuarioRequestValidator()
    {
        RuleFor(x => x.Nombre).MaximumLength(100).When(x => x.Nombre != null);
        RuleFor(x => x.Telefono).MaximumLength(20).When(x => x.Telefono != null);
    }
}
