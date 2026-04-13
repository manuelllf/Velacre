# Dependency Injection en ASP.NET Core

Fuentes:
- [Microsoft Learn - DI Guidelines](https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection/guidelines)
- [Microsoft Learn - DI in ASP.NET Core](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/dependency-injection?view=aspnetcore-10.0)

---

## 1. Service Lifetimes

| Lifetime | Comportamiento | Uso tipico |
|-----------|---------------|------------|
| **Transient** | Nueva instancia cada vez que se solicita | Servicios ligeros sin estado |
| **Scoped** | Una instancia por scope (= por request HTTP) | DbContext, Unit of Work |
| **Singleton** | Una instancia para toda la aplicacion | Caches, configuracion, HttpClient |

```csharp
builder.Services.AddTransient<IEmailSender, EmailSender>();
builder.Services.AddScoped<IOrderService, OrderService>();
builder.Services.AddSingleton<ICacheService, CacheService>();
```

---

## 2. Reglas de Diseno de Servicios

- Evitar clases y miembros estaticos con estado; usar singletons en su lugar
- No instanciar dependencias directamente dentro de servicios
- Hacer servicios pequenos, bien factorizados y facilmente testeables
- Si una clase tiene muchas dependencias inyectadas, probablemente viola SRP: refactorizar

---

## 3. Registro de Servicios

```csharp
// Interfaz + implementacion
builder.Services.AddScoped<IMyService, MyService>();

// Solo implementacion (se registra como su propio tipo)
builder.Services.AddSingleton<MyService>();

// Factory
builder.Services.AddScoped<IMyService>(sp =>
{
    var config = sp.GetRequiredService<IConfiguration>();
    return new MyService(config["Key"]!);
});

// Multiples implementaciones (ultima gana para inyeccion simple)
builder.Services.AddSingleton<ICache, RedisCache>();
builder.Services.AddSingleton<ICache, MemoryCache>(); // esta se inyecta
// Para obtener todas: IEnumerable<ICache>
```

---

## 4. Extension Methods para Agrupar Registros

```csharp
namespace Microsoft.Extensions.DependencyInjection;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services, IConfiguration config)
    {
        services.AddScoped<IUnitOfWork, UnitOfWork>();
        services.AddScoped<IProductRepository, ProductRepository>();
        services.Configure<DatabaseOptions>(config.GetSection("Database"));
        return services;
    }
}

// En Program.cs
builder.Services.AddInfrastructure(builder.Configuration);
```

---

## 5. Keyed Services (.NET 8+)

```csharp
builder.Services.AddKeyedSingleton<ICache, RedisCache>("redis");
builder.Services.AddKeyedSingleton<ICache, MemoryCache>("memory");

// Inyeccion
app.MapGet("/data", ([FromKeyedServices("redis")] ICache cache) =>
    cache.Get("key"));

// En clases
public class MyService([FromKeyedServices("redis")] ICache cache) { }
```

---

## 6. Disposal de Servicios

**El contenedor se encarga del Dispose.** No hacerlo manualmente.

- Transient y Scoped: disposed al final del scope
- Singleton: disposed cuando se cierra la aplicacion
- Servicios creados fuera del contenedor (`new Service()`) NO se disponen automaticamente

```csharp
// MAL - el contenedor no gestiona el dispose
builder.Services.AddSingleton(new MyService());
// El developer debe disponer manualmente

// BIEN - el contenedor lo gestiona
builder.Services.AddSingleton<MyService>();
```

---

## 7. Anti-Patrones Criticos

### Captive Dependency (dependencia cautiva)
```csharp
// MAL - Singleton captura Scoped
builder.Services.AddSingleton<Foo>();   // Singleton
builder.Services.AddScoped<Bar>();       // Scoped

public class Foo(Bar bar) { }  // Bar vive tanto como Foo = LEAK
```

**Regla:** Un servicio nunca debe depender de otro con lifetime mas corto.
- Singleton puede depender de: Singleton
- Scoped puede depender de: Singleton, Scoped
- Transient puede depender de: Singleton, Scoped, Transient

Activar validacion de scopes en desarrollo:
```csharp
builder.Host.UseDefaultServiceProvider(options =>
{
    options.ValidateScopes = true;
    options.ValidateOnBuild = true;
});
```

### Async DI Factories = Deadlock
```csharp
// MAL - causa deadlock
builder.Services.AddSingleton<IBar>(sp =>
{
    return GetBarAsync(sp).Result;  // DEADLOCK
});
```

### Transient Disposable = Memory Leak
```csharp
// CUIDADO - el contenedor retiene la referencia para hacer Dispose
builder.Services.AddTransient<IDisposableService, DisposableService>();
// Si se resuelve desde el root container, no se libera hasta shutdown
```

---

## 8. Recomendaciones Oficiales Microsoft

- No almacenar datos/configuracion en el contenedor DI; usar Options pattern
- No acceder a servicios de forma estatica; no capturar `IApplicationBuilder.ApplicationServices`
- No usar Service Locator pattern (evitar `GetService` manual)
- No llamar `BuildServiceProvider` durante configuracion de servicios
- Mantener factories DI rapidas y sincronas
- No soporta constructores async; resolver sincrono y luego usar metodos async

```csharp
// MAL - Service Locator
public class MyController(IServiceProvider sp)
{
    public void DoWork()
    {
        var service = sp.GetService<IMyService>(); // NO
    }
}

// BIEN - inyeccion directa
public class MyController(IMyService service)
{
    public void DoWork()
    {
        service.Execute();
    }
}
```

---

## 9. Middleware y Scoped Services

```csharp
// MAL - inyectar scoped en constructor de middleware (se comporta como singleton)
public class MyMiddleware(IScopedService service) { }

// BIEN - inyectar en InvokeAsync
public class MyMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, IScopedService service)
    {
        // service tiene el scope correcto del request
        await next(context);
    }
}
```

---

## 10. Resolver Servicio al Iniciar

```csharp
var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
}

app.Run();
```

---

## 11. Thread Safety

- Singletons DEBEN ser thread-safe
- El contenedor DI es thread-safe para resoluciones
- Las instancias resueltas NO son automaticamente thread-safe
- Singleton con estado mutable necesita sincronizacion propia

---

## 12. Contenedor Built-in vs Third-Party

El contenedor built-in es suficiente para la mayoria de apps. Solo usar third-party (Autofac, etc.) si necesitas:
- Property injection
- Child containers
- Custom lifetime management
- `Func<T>` para lazy initialization
- Registro por convencion
