using System.Security.Claims;
using backend.Controllers;
using backend.Interfaces;
using backend.Models.Entities;
using backend.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace backend.Tests.Controllers;

public class UsuarioControllerTests
{
    private static readonly Guid TestUserId = Guid.Parse("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");

    private static UsuarioController CreateController(
        Mock<IUsuarioRepository> usuarioRepo,
        Mock<INegocioRepository>? negocioRepo = null,
        Mock<IReviewRepository>? reviewRepo = null)
    {
        Environment.SetEnvironmentVariable("ADMIN_USER_ID", "00000000-0000-0000-0000-000000000000");
        var logger = Mock.Of<ILogger<UsuarioController>>();
        var emailService = new Mock<EmailService>(Mock.Of<IHttpClientFactory>(), Mock.Of<ILogger<EmailService>>());
        var httpFactory = new Mock<IHttpClientFactory>();
        httpFactory.Setup(f => f.CreateClient(It.IsAny<string>())).Returns(new HttpClient());

        var controller = new UsuarioController(
            usuarioRepo.Object,
            negocioRepo?.Object ?? Mock.Of<INegocioRepository>(),
            reviewRepo?.Object ?? Mock.Of<IReviewRepository>(),
            logger,
            emailService.Object,
            httpFactory.Object);

        var claims = new[] { new Claim("sub", TestUserId.ToString()) };
        var identity = new ClaimsIdentity(claims, "Test");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) }
        };

        return controller;
    }

    [Fact]
    public async Task GetMe_UserExists_ReturnsOk()
    {
        var repo = new Mock<IUsuarioRepository>();
        repo.Setup(r => r.GetByIdAsync(TestUserId))
            .ReturnsAsync(new UsuarioEntity
            {
                Id = TestUserId,
                Nombre = "Manuel",
                Plan = "core",
                Activo = true,
                Rol = "cliente",
                RespuestasIaMes = 5,
            });

        var controller = CreateController(repo);
        var result = await controller.GetMe();

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal(200, ok.StatusCode);
    }

    [Fact]
    public async Task GetMe_UserNotFound_Returns404()
    {
        var repo = new Mock<IUsuarioRepository>();
        repo.Setup(r => r.GetByIdAsync(TestUserId))
            .ReturnsAsync((UsuarioEntity?)null);

        var controller = CreateController(repo);
        var result = await controller.GetMe();

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task GetMe_AdminUser_ReturnsAdminRole()
    {
        // Set the admin user ID to match our test user
        Environment.SetEnvironmentVariable("ADMIN_USER_ID", TestUserId.ToString());
        var repo = new Mock<IUsuarioRepository>();
        repo.Setup(r => r.GetByIdAsync(TestUserId))
            .ReturnsAsync(new UsuarioEntity
            {
                Id = TestUserId,
                Nombre = "Admin",
                Plan = "pro",
                Activo = true,
                Rol = "cliente",
            });

        var controller = CreateController(repo);
        var result = await controller.GetMe();

        var ok = Assert.IsType<OkObjectResult>(result);
        var json = System.Text.Json.JsonSerializer.Serialize(ok.Value);
        // Anonymous type property names are PascalCase in System.Text.Json
        Assert.Contains("isAdmin", json, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("true", json);

        // Restore the env var
        Environment.SetEnvironmentVariable("ADMIN_USER_ID", "00000000-0000-0000-0000-000000000000");
    }

    [Fact]
    public async Task GetMe_ProOverrideActive_ReturnsPlanPro()
    {
        var repo = new Mock<IUsuarioRepository>();
        repo.Setup(r => r.GetByIdAsync(TestUserId))
            .ReturnsAsync(new UsuarioEntity
            {
                Id = TestUserId,
                Nombre = "Test",
                Plan = "basic",
                ProOverride = true,
                ProOverrideHasta = DateTimeOffset.UtcNow.AddDays(30),
                Activo = true,
                Rol = "cliente",
            });

        var controller = CreateController(repo);
        var result = await controller.GetMe();

        var ok = Assert.IsType<OkObjectResult>(result);
        var json = System.Text.Json.JsonSerializer.Serialize(ok.Value);
        Assert.Contains("plan", json, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("pro", json);
    }
}
