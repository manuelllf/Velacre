using backend.Infrastructure;
using backend.Interfaces;
using backend.Models.Entities;
using Microsoft.AspNetCore.Http;
using Moq;
using Xunit;

namespace backend.Tests.Infrastructure;

/// <summary>
/// Tests de <see cref="NegocioScopeExtensions.ResolveScopedAsync"/> — la función que usan
/// todos los controllers (Review, Radar, Places, Google, Health) para saber sobre qué local
/// operan en cada request multi-local.
/// </summary>
public class NegocioScopeExtensionsTests
{
    private static readonly Guid UserId = Guid.Parse("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");

    private static HttpContext Ctx(
        string? header = null,
        string? query = null)
    {
        var ctx = new DefaultHttpContext();
        if (header != null) ctx.Request.Headers["X-Negocio-Id"] = header;
        if (query != null) ctx.Request.QueryString = new QueryString($"?negocio_id={query}");
        return ctx;
    }

    [Fact]
    public async Task NoHint_FallsBackToPrimary()
    {
        var repo = new Mock<INegocioRepository>();
        var primary = new NegocioEntity { Id = Guid.NewGuid(), IdUsuario = UserId, EsPrincipal = true };
        repo.Setup(r => r.GetByUserIdAsync(UserId)).ReturnsAsync(primary);

        var result = await repo.Object.ResolveScopedAsync(Ctx(), UserId);

        Assert.Equal(primary.Id, result!.Id);
        repo.Verify(r => r.GetByIdAndUserIdAsync(It.IsAny<Guid>(), It.IsAny<Guid>()), Times.Never);
    }

    [Fact]
    public async Task HeaderTakesPriorityOverQuery()
    {
        var headerId = Guid.NewGuid();
        var queryId = Guid.NewGuid();
        var repo = new Mock<INegocioRepository>();
        repo.Setup(r => r.GetByIdAndUserIdAsync(headerId, UserId))
            .ReturnsAsync(new NegocioEntity { Id = headerId, IdUsuario = UserId });

        var result = await repo.Object.ResolveScopedAsync(Ctx(header: headerId.ToString(), query: queryId.ToString()), UserId);

        Assert.Equal(headerId, result!.Id);
        repo.Verify(r => r.GetByIdAndUserIdAsync(headerId, UserId), Times.Once);
        repo.Verify(r => r.GetByIdAndUserIdAsync(queryId, UserId), Times.Never);
        repo.Verify(r => r.GetByUserIdAsync(It.IsAny<Guid>()), Times.Never);
    }

    [Fact]
    public async Task QueryParamUsedWhenNoHeader()
    {
        var queryId = Guid.NewGuid();
        var repo = new Mock<INegocioRepository>();
        repo.Setup(r => r.GetByIdAndUserIdAsync(queryId, UserId))
            .ReturnsAsync(new NegocioEntity { Id = queryId, IdUsuario = UserId });

        var result = await repo.Object.ResolveScopedAsync(Ctx(query: queryId.ToString()), UserId);

        Assert.Equal(queryId, result!.Id);
    }

    [Fact]
    public async Task InvalidGuidReturnsNull()
    {
        var repo = new Mock<INegocioRepository>();
        var result = await repo.Object.ResolveScopedAsync(Ctx(header: "not-a-guid"), UserId);
        Assert.Null(result);
    }

    [Fact]
    public async Task UnownedNegocioIdReturnsNull()
    {
        var id = Guid.NewGuid();
        var repo = new Mock<INegocioRepository>();
        repo.Setup(r => r.GetByIdAndUserIdAsync(id, UserId)).ReturnsAsync((NegocioEntity?)null);

        var result = await repo.Object.ResolveScopedAsync(Ctx(header: id.ToString()), UserId);
        Assert.Null(result);
    }

    [Fact]
    public async Task NoHintAndNoNegocios_ReturnsNull()
    {
        // Caso del usuario recién registrado antes de completar onboarding:
        // no hay header, no hay query, no tiene negocios todavía. La extensión
        // debe devolver null limpiamente (el controller decide qué hacer con el 404).
        var repo = new Mock<INegocioRepository>();
        repo.Setup(r => r.GetByUserIdAsync(UserId)).ReturnsAsync((NegocioEntity?)null);

        var result = await repo.Object.ResolveScopedAsync(Ctx(), UserId);

        Assert.Null(result);
    }

    [Fact]
    public async Task EmptyHeaderFallsBackToQuery()
    {
        var queryId = Guid.NewGuid();
        var repo = new Mock<INegocioRepository>();
        repo.Setup(r => r.GetByIdAndUserIdAsync(queryId, UserId))
            .ReturnsAsync(new NegocioEntity { Id = queryId, IdUsuario = UserId });

        var ctx = new DefaultHttpContext();
        ctx.Request.Headers["X-Negocio-Id"] = "";
        ctx.Request.QueryString = new QueryString($"?negocio_id={queryId}");

        var result = await repo.Object.ResolveScopedAsync(ctx, UserId);
        Assert.Equal(queryId, result!.Id);
    }
}
