# ASP.NET Core Best Practices

Fuente: [Microsoft Learn - ASP.NET Core Best Practices](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/best-practices?view=aspnetcore-10.0)

---

## 1. Llamadas Asincronas (No Bloquear Hilos)

ASP.NET Core procesa muchas peticiones concurrentes con un pool de hilos limitado.
Bloquear hilos causa **Thread Pool starvation**.

```csharp
// MAL - bloquea el hilo
var result = someTask.Result;        // NO
someTask.Wait();                      // NO
Task.Run(() => Work()).Wait();        // NO

// BIEN - todo asincrono
var result = await someTask;
await DoWorkAsync();
```

**Reglas:**
- Hacer async todo el call stack (controller -> service -> repository)
- No usar `Task.Run` para envolver APIs sincronas
- No adquirir locks en hot code paths
- Usar `async Task` en actions, nunca `async void`

---

## 2. Acceso a Datos y I/O

```csharp
// BIEN
var users = await dbContext.Users
    .AsNoTracking()                    // solo lectura = no tracking
    .Where(u => u.IsActive)            // filtrar en BD, no en memoria
    .Select(u => new UserDto { ... })  // proyeccion: solo campos necesarios
    .ToListAsync();
```

**Reglas:**
- Todas las llamadas a datos deben ser async
- No traer mas datos de los necesarios
- Usar `AsNoTracking()` para consultas de solo lectura
- Filtrar y agregar con LINQ en la BD (`.Where`, `.Select`, `.Sum`)
- Minimizar round-trips: una sola llamada en vez de varias
- Cachear datos frecuentes si toleras datos ligeramente desactualizados

---

## 3. Paginacion

```csharp
// MAL - devolver toda la coleccion
return await dbContext.Products.ToListAsync();

// BIEN - paginar
return await dbContext.Products
    .Skip((page - 1) * pageSize)
    .Take(pageSize)
    .ToListAsync();
```

- Evitar `IEnumerable<T>` en acciones (iteracion sincrona)
- Preferir `IAsyncEnumerable<T>` o `ToListAsync()` antes de devolver

---

## 4. HttpClient (Usar HttpClientFactory)

```csharp
// MAL - crear y destruir HttpClient
using var client = new HttpClient();  // socket exhaustion

// BIEN - usar factory
builder.Services.AddHttpClient<MyService>(client =>
{
    client.BaseAddress = new Uri("https://api.example.com");
});

public class MyService(HttpClient httpClient) { ... }
```

---

## 5. Caching

```csharp
// In-memory cache
builder.Services.AddMemoryCache();

// Distributed cache (Redis, SQL Server, etc.)
builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = "localhost";
});
```

Cachear agresivamente cuando datos ligeramente desactualizados son aceptables.

---

## 6. HttpContext - Reglas Criticas

```csharp
// MAL - guardar HttpContext en un campo
public class MyService
{
    private readonly HttpContext _context; // NUNCA
}

// BIEN - guardar IHttpContextAccessor y acceder en el momento
public class MyService(IHttpContextAccessor accessor)
{
    public void DoWork()
    {
        var context = accessor.HttpContext; // acceder cuando se necesita
        if (context != null) { ... }
    }
}
```

**Reglas:**
- HttpContext NO es thread-safe: no acceder desde multiples hilos
- No capturar HttpContext en closures de background threads
- No usar HttpContext despues de que la peticion termine
- Copiar datos necesarios antes de lanzar trabajo en paralelo

---

## 7. Background Work

```csharp
// MAL - trabajo largo en el request
[HttpPost]
public async Task<IActionResult> Process()
{
    await LongRunningWork(); // bloquea la respuesta
    return Ok();
}

// BIEN - offload a background service
[HttpPost]
public IActionResult Process()
{
    _queue.Enqueue(workItem);
    return Accepted();
}
```

Usar `IHostedService` / `BackgroundService` o message brokers (Azure Service Bus, RabbitMQ).

---

## 8. Excepciones

- Las excepciones son caras: no usarlas para control de flujo
- Incluir logica para detectar condiciones que causarian excepciones
- Reservar throw/catch para condiciones inesperadas

---

## 9. Memoria y Large Object Heap

Objetos >= 85,000 bytes van al LOH (recoleccion costosa Gen2).

```csharp
// BIEN - usar ArrayPool para buffers grandes
var pool = ArrayPool<byte>.Shared;
var buffer = pool.Rent(1024);
try { /* usar buffer */ }
finally { pool.Return(buffer); }
```

- Cachear objetos grandes reutilizables
- No asignar objetos grandes de vida corta en hot paths

---

## 10. Request/Response Body

```csharp
// MAL - lectura sincrona
var json = new StreamReader(Request.Body).ReadToEnd();

// BIEN - lectura asincrona sin buffering
var data = await JsonSerializer.DeserializeAsync<MyDto>(Request.Body);

// MAL - Form sincrono
var form = HttpContext.Request.Form;

// BIEN - Form asincrono
var form = await HttpContext.Request.ReadFormAsync();
```

---

## 11. Response Headers

```csharp
// MAL - modificar headers despues de escribir body
await next();
context.Response.Headers["X-Custom"] = "value"; // EXCEPCION

// BIEN - verificar antes
if (!context.Response.HasStarted)
    context.Response.Headers["X-Custom"] = "value";

// MEJOR - usar OnStarting
context.Response.OnStarting(() =>
{
    context.Response.Headers["X-Custom"] = "value";
    return Task.CompletedTask;
});
await next();
```

---

## 12. Servicios en Background Threads

```csharp
// MAL - capturar DbContext del request en Task.Run
_ = Task.Run(async () =>
{
    context.Contoso.Add(new Contoso()); // DbContext ya disposed!
});

// BIEN - crear scope nuevo
_ = Task.Run(async () =>
{
    await using var scope = serviceScopeFactory.CreateAsyncScope();
    var db = scope.ServiceProvider.GetRequiredService<ContosoDbContext>();
    db.Contoso.Add(new Contoso());
    await db.SaveChangesAsync();
});
```

---

## 13. Rendimiento General

- Usar siempre la ultima version de ASP.NET Core
- Usar `System.Text.Json` (mas rapido que Newtonsoft)
- Comprimir respuestas (response compression middleware)
- Minificar assets del cliente (JS, CSS)
- Usar in-process hosting con IIS
- No asumir que `Request.ContentLength` no es null
