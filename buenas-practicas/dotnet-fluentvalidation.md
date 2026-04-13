# FluentValidation en ASP.NET Core

Fuentes:
- [FluentValidation Docs - ASP.NET Integration](https://docs.fluentvalidation.net/en/latest/aspnet.html)
- [codewithmukesh - FluentValidation in ASP.NET Core](https://codewithmukesh.com/blog/fluentvalidation-in-aspnet-core/)

---

## 1. Instalacion (v12+)

```bash
dotnet add package FluentValidation
dotnet add package FluentValidation.DependencyInjectionExtensions
```

**IMPORTANTE:** El paquete `FluentValidation.AspNetCore` esta DEPRECADO y eliminado en v12.
Ya no existe auto-validacion en el pipeline MVC. Usar validacion manual o endpoint filters.

---

## 2. Registro en DI

```csharp
// Registrar todos los validators del assembly (recomendado)
builder.Services.AddValidatorsFromAssemblyContaining<Program>();

// O registrar individualmente
builder.Services.AddScoped<IValidator<CreateOrderRequest>, CreateOrderValidator>();
```

---

## 3. Crear Validators

```csharp
public class CreateOrderRequest
{
    public string CustomerEmail { get; set; } = default!;
    public string ProductName { get; set; } = default!;
    public int Quantity { get; set; }
    public decimal Price { get; set; }
}

public class CreateOrderValidator : AbstractValidator<CreateOrderRequest>
{
    public CreateOrderValidator()
    {
        RuleFor(x => x.CustomerEmail)
            .NotEmpty().WithMessage("Email es obligatorio")
            .EmailAddress().WithMessage("Email no valido");

        RuleFor(x => x.ProductName)
            .NotEmpty()
            .MaximumLength(200);

        RuleFor(x => x.Quantity)
            .GreaterThan(0).WithMessage("Cantidad debe ser mayor que 0");

        RuleFor(x => x.Price)
            .GreaterThanOrEqualTo(0.01m);
    }
}
```

---

## 4. Validacion Manual (Minimal APIs)

```csharp
app.MapPost("/orders", async (
    CreateOrderRequest request,
    IValidator<CreateOrderRequest> validator) =>
{
    var result = await validator.ValidateAsync(request);

    if (!result.IsValid)
        return Results.ValidationProblem(result.ToDictionary());

    // procesar orden...
    return Results.Created($"/orders/{id}", order);
});
```

---

## 5. Endpoint Filter (Auto-Validacion para Minimal APIs)

```csharp
public class ValidationFilter<T> : IEndpointFilter where T : class
{
    public async ValueTask<object?> InvokeAsync(
        EndpointFilterInvocationContext context,
        EndpointFilterDelegate next)
    {
        var validator = context.HttpContext.RequestServices
            .GetService<IValidator<T>>();

        if (validator is null)
            return await next(context);

        var model = context.Arguments.OfType<T>().FirstOrDefault();
        if (model is null)
            return Results.Problem("Request body required", statusCode: 400);

        var result = await validator.ValidateAsync(model);
        if (!result.IsValid)
            return Results.ValidationProblem(result.ToDictionary());

        return await next(context);
    }
}

// Uso
app.MapPost("/orders", (CreateOrderRequest request) => Results.Ok())
   .AddEndpointFilter<ValidationFilter<CreateOrderRequest>>();
```

---

## 6. Validacion en Controllers (MVC)

```csharp
[ApiController]
[Route("api/[controller]")]
public class OrdersController(IValidator<CreateOrderRequest> validator) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Create(CreateOrderRequest request)
    {
        var result = await validator.ValidateAsync(request);
        if (!result.IsValid)
        {
            result.AddToModelState(ModelState);
            return ValidationProblem(ModelState);
        }

        // procesar...
        return Ok();
    }
}
```

---

## 7. Validadores Comunes

| Validador | Uso |
|-----------|-----|
| `NotEmpty()` | Campo obligatorio (strings, collections) |
| `NotNull()` | No null |
| `EmailAddress()` | Formato email |
| `MinimumLength(n)` | Longitud minima string |
| `MaximumLength(n)` | Longitud maxima string |
| `GreaterThan(n)` | Mayor que valor |
| `LessThanOrEqualTo(n)` | Menor o igual |
| `Matches(regex)` | Expresion regular |
| `Must(predicate)` | Predicado custom sincrono |
| `MustAsync(predicate)` | Predicado custom asincrono |
| `Equal(x => x.Prop)` | Comparacion entre propiedades |
| `InclusiveBetween(a, b)` | Rango inclusivo |

---

## 8. Cascade Mode (Parar en Primer Error)

```csharp
RuleFor(x => x.Email)
    .Cascade(CascadeMode.Stop)  // si falla NotEmpty, no ejecuta EmailAddress
    .NotEmpty()
    .EmailAddress();

// Configurar globalmente
ValidatorOptions.Global.DefaultRuleLevelCascadeMode = CascadeMode.Stop;
```

---

## 9. Validacion Custom

```csharp
// Sincrona
RuleFor(x => x.Name)
    .Must(name => name.All(char.IsLetter))
    .WithMessage("Solo letras permitidas");

// Asincrona (consulta a BD, servicio externo)
RuleFor(x => x.Email)
    .MustAsync(async (email, ct) =>
        !await dbContext.Users.AnyAsync(u => u.Email == email, ct))
    .WithMessage("Email ya registrado");
```

**CRITICO:** Si tienes reglas async, SIEMPRE usar `ValidateAsync()`.
FluentValidation 11+ lanza `AsyncValidatorInvokedSynchronouslyException` si usas `Validate()` con reglas async.

---

## 10. Validacion Condicional

```csharp
// Solo validar si se cumple condicion
RuleFor(x => x.ShippingAddress)
    .NotEmpty()
    .When(x => x.RequiresShipping);

// Unless (inverso de When)
RuleFor(x => x.DigitalLicense)
    .NotEmpty()
    .Unless(x => x.RequiresShipping);
```

---

## 11. Validacion de Objetos Hijos

```csharp
public class OrderValidator : AbstractValidator<Order>
{
    public OrderValidator()
    {
        RuleFor(x => x.Customer)
            .SetValidator(new CustomerValidator());

        RuleForEach(x => x.Items)
            .SetValidator(new OrderItemValidator());
    }
}
```

---

## 12. Integracion con MediatR (Pipeline Behavior)

```csharp
public class ValidationBehavior<TRequest, TResponse>(
    IValidator<TRequest>? validator = null)
    : IPipelineBehavior<TRequest, TResponse> where TRequest : notnull
{
    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken ct)
    {
        if (validator is null)
            return await next();

        var result = await validator.ValidateAsync(request, ct);
        if (!result.IsValid)
            throw new ValidationException(result.Errors);

        return await next();
    }
}

// Registro
builder.Services.AddTransient(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
```

---

## 13. Testing de Validators

```csharp
[Fact]
public async Task CreateOrder_EmptyEmail_ShouldFail()
{
    var validator = new CreateOrderValidator();
    var request = new CreateOrderRequest { CustomerEmail = "" };

    var result = await validator.ValidateAsync(request);

    result.IsValid.Should().BeFalse();
    result.Errors.Should().Contain(e =>
        e.PropertyName == "CustomerEmail");
}

// Helper de FluentValidation para tests
[Fact]
public void Should_HaveError_When_EmailEmpty()
{
    var validator = new CreateOrderValidator();
    validator.TestValidate(new CreateOrderRequest { CustomerEmail = "" })
        .ShouldHaveValidationErrorFor(x => x.CustomerEmail);
}
```

---

## 14. Errores Comunes

1. **Usar `Validate()` con reglas async** -> excepcion en runtime
2. **No registrar validators** -> `IValidator<T>` es null en runtime
3. **Mezclar Data Annotations con FluentValidation** -> desactivar annotations si usas FV exclusivamente
4. **Usar el paquete deprecado `FluentValidation.AspNetCore`** -> migrar a manual validation o endpoint filters
