using backend.Models.Requests;
using FluentValidation;

namespace backend.Validators;

public class ReportErrorRequestValidator : AbstractValidator<ReportErrorRequest>
{
    public ReportErrorRequestValidator()
    {
        RuleFor(x => x.Url).MaximumLength(2000).When(x => x.Url != null);
        RuleFor(x => x.ErrorMessage).MaximumLength(2000).When(x => x.ErrorMessage != null);
        RuleFor(x => x.Observaciones).MaximumLength(5000).When(x => x.Observaciones != null);
    }
}
