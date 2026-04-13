# Repository Pattern en ASP.NET Core

Fuentes:
- [Code Maze - Repository Pattern](https://code-maze.com/net-core-web-development-part4/)
- [Microsoft Learn - Repository and Unit of Work](https://learn.microsoft.com/en-us/aspnet/mvc/overview/older-versions/getting-started-with-ef-5-using-mvc-4/implementing-the-repository-and-unit-of-work-patterns-in-an-asp-net-mvc-application)

---

## 1. Proposito

El Repository Pattern crea una capa de abstraccion entre el acceso a datos y la logica de negocio.

**Beneficios:**
- Separacion de concerns: la logica de negocio no depende de la BD
- Testabilidad: se puede mockear el repositorio en tests
- Flexibilidad: cambiar de BD sin tocar la logica de negocio
- Consistencia: operaciones de datos centralizadas

---

## 2. Estructura General

```
Domain/
  Entities/
    Product.cs
  Interfaces/
    IRepository.cs
    IProductRepository.cs
    IUnitOfWork.cs

Infrastructure/
  Persistence/
    AppDbContext.cs
    Repositories/
      RepositoryBase.cs
      ProductRepository.cs
    UnitOfWork.cs
```

---

## 3. Interfaz Generica del Repositorio

```csharp
public interface IRepository<T> where T : class
{
    Task<T?> GetByIdAsync(int id, CancellationToken ct = default);
    Task<IReadOnlyList<T>> GetAllAsync(CancellationToken ct = default);
    IQueryable<T> FindByCondition(Expression<Func<T, bool>> expression);
    void Add(T entity);
    void Update(T entity);
    void Remove(T entity);
}
```

---

## 4. Implementacion Generica

```csharp
public abstract class RepositoryBase<T> : IRepository<T> where T : class
{
    protected readonly AppDbContext Context;

    protected RepositoryBase(AppDbContext context)
    {
        Context = context;
    }

    public async Task<T?> GetByIdAsync(int id, CancellationToken ct = default)
        => await Context.Set<T>().FindAsync([id], ct);

    public async Task<IReadOnlyList<T>> GetAllAsync(CancellationToken ct = default)
        => await Context.Set<T>().AsNoTracking().ToListAsync(ct);

    public IQueryable<T> FindByCondition(Expression<Func<T, bool>> expression)
        => Context.Set<T>().Where(expression).AsNoTracking();

    public void Add(T entity)
        => Context.Set<T>().Add(entity);

    public void Update(T entity)
        => Context.Set<T>().Update(entity);

    public void Remove(T entity)
        => Context.Set<T>().Remove(entity);
}
```

---

## 5. Repositorio Concreto

```csharp
public interface IProductRepository : IRepository<Product>
{
    Task<IReadOnlyList<Product>> GetByCategory(string category, CancellationToken ct = default);
    Task<Product?> GetWithReviews(int productId, CancellationToken ct = default);
}

public class ProductRepository : RepositoryBase<Product>, IProductRepository
{
    public ProductRepository(AppDbContext context) : base(context) { }

    public async Task<IReadOnlyList<Product>> GetByCategory(
        string category, CancellationToken ct = default)
    {
        return await Context.Products
            .AsNoTracking()
            .Where(p => p.Category == category)
            .OrderBy(p => p.Name)
            .ToListAsync(ct);
    }

    public async Task<Product?> GetWithReviews(
        int productId, CancellationToken ct = default)
    {
        return await Context.Products
            .Include(p => p.Reviews)
            .FirstOrDefaultAsync(p => p.Id == productId, ct);
    }
}
```

---

## 6. Unit of Work

Coordina multiples repositorios y garantiza una sola transaccion.

```csharp
public interface IUnitOfWork : IDisposable
{
    IProductRepository Products { get; }
    IOrderRepository Orders { get; }
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}

public class UnitOfWork : IUnitOfWork
{
    private readonly AppDbContext _context;
    private IProductRepository? _products;
    private IOrderRepository? _orders;

    public UnitOfWork(AppDbContext context)
    {
        _context = context;
    }

    public IProductRepository Products =>
        _products ??= new ProductRepository(_context);

    public IOrderRepository Orders =>
        _orders ??= new OrderRepository(_context);

    public async Task<int> SaveChangesAsync(CancellationToken ct = default)
        => await _context.SaveChangesAsync(ct);

    public void Dispose()
        => _context.Dispose();
}
```

---

## 7. Registro en DI

```csharp
public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddPersistence(
        this IServiceCollection services, IConfiguration config)
    {
        services.AddDbContext<AppDbContext>(options =>
            options.UseSqlServer(config.GetConnectionString("Default")));

        services.AddScoped<IUnitOfWork, UnitOfWork>();

        // Si prefieres inyectar repos individuales (sin UoW):
        services.AddScoped<IProductRepository, ProductRepository>();
        services.AddScoped<IOrderRepository, OrderRepository>();

        return services;
    }
}

// Program.cs
builder.Services.AddPersistence(builder.Configuration);
```

---

## 8. Uso en un Servicio

```csharp
public class OrderService(IUnitOfWork unitOfWork)
{
    public async Task CreateOrder(CreateOrderDto dto, CancellationToken ct)
    {
        var product = await unitOfWork.Products
            .GetByIdAsync(dto.ProductId, ct)
            ?? throw new NotFoundException("Product not found");

        var order = new Order
        {
            ProductId = product.Id,
            Quantity = dto.Quantity,
            Total = product.Price * dto.Quantity
        };

        unitOfWork.Orders.Add(order);
        await unitOfWork.SaveChangesAsync(ct);
    }
}
```

---

## 9. Cuando NO Usar Repository Pattern

- **CRUD simple** con pocas entidades: EF Core DbContext ya es un repository + UoW
- **Prototipo rapido**: agrega complejidad innecesaria
- **Queries muy complejas**: a veces es mejor usar DbContext directamente o CQRS

**Alternativa moderna:** Usar DbContext directamente con metodos de extension o el patron Specification.

---

## 10. Specification Pattern (Complemento)

Para queries complejas reutilizables:

```csharp
public abstract class Specification<T> where T : class
{
    public Expression<Func<T, bool>>? Criteria { get; protected init; }
    public List<Expression<Func<T, object>>> Includes { get; } = [];
    public Expression<Func<T, object>>? OrderBy { get; protected init; }
    public int? Take { get; protected init; }
    public int? Skip { get; protected init; }
}

public class ActiveProductsByCategorySpec : Specification<Product>
{
    public ActiveProductsByCategorySpec(string category)
    {
        Criteria = p => p.IsActive && p.Category == category;
        OrderBy = p => p.Name;
        Includes.Add(p => p.Reviews);
    }
}

// En el repositorio generico
public async Task<IReadOnlyList<T>> ListAsync(
    Specification<T> spec, CancellationToken ct = default)
{
    var query = Context.Set<T>().AsQueryable();

    if (spec.Criteria != null)
        query = query.Where(spec.Criteria);

    query = spec.Includes.Aggregate(query,
        (current, include) => current.Include(include));

    if (spec.OrderBy != null)
        query = query.OrderBy(spec.OrderBy);

    if (spec.Skip.HasValue)
        query = query.Skip(spec.Skip.Value);

    if (spec.Take.HasValue)
        query = query.Take(spec.Take.Value);

    return await query.AsNoTracking().ToListAsync(ct);
}
```

---

## 11. Reglas Practicas

1. **AsNoTracking por defecto** en queries de lectura
2. **No exponer IQueryable** fuera del repositorio si quieres control total
3. **SaveChanges solo en Unit of Work**, nunca en repositorios individuales
4. **Un repositorio por aggregate root**, no por tabla
5. **CancellationToken** en todos los metodos async
6. **Scoped lifetime** para repositorios y UoW (coincide con el scope de DbContext)
7. **No mezclar** repository pattern con acceso directo a DbContext en el mismo proyecto
