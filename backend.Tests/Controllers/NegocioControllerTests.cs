using System.Security.Claims;
using backend.Controllers;
using backend.Interfaces;
using backend.Models.Entities;
using backend.Models.Requests;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace backend.Tests.Controllers;

public class NegocioControllerTests
{
    private static readonly Guid TestUserId = Guid.Parse("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");

    private static NegocioController CreateController(Mock<INegocioRepository> repoMock)
    {
        Environment.SetEnvironmentVariable("ADMIN_USER_ID", "00000000-0000-0000-0000-000000000000");
        var logger = Mock.Of<ILogger<NegocioController>>();
        var controller = new NegocioController(repoMock.Object, logger);

        var claims = new[] { new Claim("sub", TestUserId.ToString()) };
        var identity = new ClaimsIdentity(claims, "Test");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) }
        };

        return controller;
    }

    [Fact]
    public async Task GetMyNegocio_Exists_ReturnsOk()
    {
        var repo = new Mock<INegocioRepository>();
        repo.Setup(r => r.GetByUserIdAsync(TestUserId))
            .ReturnsAsync(new NegocioEntity
            {
                Id = Guid.NewGuid(),
                Nombre = "Mi Bar",
                Codigo = "NEG123",
                IdUsuario = TestUserId,
                TonoPredefinido = "Cercano",
            });

        var controller = CreateController(repo);
        var result = await controller.GetMyNegocio();

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal(200, ok.StatusCode);
    }

    [Fact]
    public async Task GetMyNegocio_NotFound_Returns404()
    {
        var repo = new Mock<INegocioRepository>();
        repo.Setup(r => r.GetByUserIdAsync(TestUserId))
            .ReturnsAsync((NegocioEntity?)null);

        var controller = CreateController(repo);
        var result = await controller.GetMyNegocio();

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task CreateNegocio_Success_ReturnsCreated()
    {
        var repo = new Mock<INegocioRepository>();
        repo.Setup(r => r.InsertAsync(It.IsAny<NegocioEntity>())).Returns(Task.CompletedTask);
        repo.Setup(r => r.GetByUserIdAsync(TestUserId))
            .ReturnsAsync(new NegocioEntity
            {
                Id = Guid.NewGuid(),
                Nombre = "Nuevo Bar",
                Codigo = "NEG456",
                IdUsuario = TestUserId,
            });

        var controller = CreateController(repo);
        var result = await controller.CreateNegocio(new CreateNegocioRequest
        {
            Nombre = "Nuevo Bar",
        });

        var created = Assert.IsType<CreatedResult>(result);
        Assert.Equal(201, created.StatusCode);
    }

    [Fact]
    public async Task UpdateNegocio_NotFound_Returns404()
    {
        var repo = new Mock<INegocioRepository>();
        repo.Setup(r => r.GetByUserIdAsync(TestUserId))
            .ReturnsAsync((NegocioEntity?)null);

        var controller = CreateController(repo);
        var result = await controller.UpdateNegocio(new UpdateNegocioRequest { Nombre = "Nuevo" });

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task UpdateNegocio_Success_ReturnsOk()
    {
        var repo = new Mock<INegocioRepository>();
        repo.Setup(r => r.GetByUserIdAsync(TestUserId))
            .ReturnsAsync(new NegocioEntity
            {
                Id = Guid.NewGuid(),
                Nombre = "Bar Viejo",
                Codigo = "NEG789",
                IdUsuario = TestUserId,
            });
        repo.Setup(r => r.UpdateAsync(It.IsAny<NegocioEntity>())).Returns(Task.CompletedTask);

        var controller = CreateController(repo);
        var result = await controller.UpdateNegocio(new UpdateNegocioRequest { Nombre = "Bar Nuevo" });

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal(200, ok.StatusCode);
    }
}
