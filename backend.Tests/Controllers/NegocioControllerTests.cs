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

    private static NegocioController CreateController(
        Mock<INegocioRepository> repoMock,
        Mock<IUsuarioRepository>? usuarioMock = null,
        Dictionary<string, string>? headers = null,
        Dictionary<string, string>? query = null)
    {
        Environment.SetEnvironmentVariable("ADMIN_USER_ID", "00000000-0000-0000-0000-000000000000");
        var logger = Mock.Of<ILogger<NegocioController>>();
        var usuarioRepo = usuarioMock ?? new Mock<IUsuarioRepository>();

        // Default: usuario Basic salvo override explícito
        if (usuarioMock == null)
        {
            usuarioRepo.Setup(r => r.GetByIdAsync(TestUserId))
                .ReturnsAsync(new UsuarioEntity { Id = TestUserId, Plan = "basic", LocalesContratados = 1 });
        }

        var controller = new NegocioController(repoMock.Object, usuarioRepo.Object, logger);

        var claims = new[] { new Claim("sub", TestUserId.ToString()) };
        var identity = new ClaimsIdentity(claims, "Test");
        var httpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) };
        if (headers != null)
            foreach (var kv in headers) httpContext.Request.Headers[kv.Key] = kv.Value;
        if (query != null)
            httpContext.Request.QueryString = new QueryString("?" + string.Join("&", query.Select(kv => $"{kv.Key}={kv.Value}")));

        controller.ControllerContext = new ControllerContext { HttpContext = httpContext };
        return controller;
    }

    private static NegocioEntity MakeNegocio(Guid? id = null, string nombre = "Mi Bar", bool esPrincipal = false, string estado = "activo", string? placeId = null)
        => new()
        {
            Id = id ?? Guid.NewGuid(),
            Nombre = nombre,
            Codigo = "NEG" + Random.Shared.Next(100, 999),
            IdUsuario = TestUserId,
            TonoPredefinido = "Cercano",
            EsPrincipal = esPrincipal,
            Estado = estado,
            PlaceId = placeId,
        };

    // ── GET /api/negocio/me ─────────────────────────────────────────────────
    [Fact]
    public async Task GetMyNegocio_Exists_ReturnsOk()
    {
        var repo = new Mock<INegocioRepository>();
        repo.Setup(r => r.GetByUserIdAsync(TestUserId)).ReturnsAsync(MakeNegocio(esPrincipal: true));

        var result = await CreateController(repo).GetMyNegocio();
        Assert.IsType<OkObjectResult>(result);
    }

    [Fact]
    public async Task GetMyNegocio_NotFound_Returns404()
    {
        var repo = new Mock<INegocioRepository>();
        repo.Setup(r => r.GetByUserIdAsync(TestUserId)).ReturnsAsync((NegocioEntity?)null);

        var result = await CreateController(repo).GetMyNegocio();
        Assert.IsType<NotFoundResult>(result);
    }

    // ── GET /api/negocio (lista) ────────────────────────────────────────────
    [Fact]
    public async Task GetAllMyNegocios_DefaultExcludesHidden()
    {
        var repo = new Mock<INegocioRepository>();
        repo.Setup(r => r.GetAllByUserIdAsync(TestUserId, false))
            .ReturnsAsync(new List<NegocioEntity> { MakeNegocio(nombre: "Bar A"), MakeNegocio(nombre: "Bar B") });

        var result = await CreateController(repo).GetAllMyNegocios(includeHidden: false);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.NotNull(ok.Value);
        repo.Verify(r => r.GetAllByUserIdAsync(TestUserId, false), Times.Once);
    }

    [Fact]
    public async Task GetAllMyNegocios_IncludeHidden_PassesFlag()
    {
        var repo = new Mock<INegocioRepository>();
        repo.Setup(r => r.GetAllByUserIdAsync(TestUserId, true))
            .ReturnsAsync(new List<NegocioEntity>());

        await CreateController(repo).GetAllMyNegocios(includeHidden: true);

        repo.Verify(r => r.GetAllByUserIdAsync(TestUserId, true), Times.Once);
    }

    // ── GET /api/negocio/:id ────────────────────────────────────────────────
    [Fact]
    public async Task GetNegocioById_OwnedReturnsOk()
    {
        var id = Guid.NewGuid();
        var repo = new Mock<INegocioRepository>();
        repo.Setup(r => r.GetByIdAndUserIdAsync(id, TestUserId)).ReturnsAsync(MakeNegocio(id: id));

        var result = await CreateController(repo).GetNegocioById(id);
        Assert.IsType<OkObjectResult>(result);
    }

    [Fact]
    public async Task GetNegocioById_NotOwned_Returns404()
    {
        var id = Guid.NewGuid();
        var repo = new Mock<INegocioRepository>();
        repo.Setup(r => r.GetByIdAndUserIdAsync(id, TestUserId)).ReturnsAsync((NegocioEntity?)null);

        var result = await CreateController(repo).GetNegocioById(id);
        Assert.IsType<NotFoundResult>(result);
    }

    // ── DELETE /api/negocio/:id (soft) ──────────────────────────────────────
    [Fact]
    public async Task DeleteNegocioById_WhenLastActive_Returns409LastActive()
    {
        var id = Guid.NewGuid();
        var repo = new Mock<INegocioRepository>();
        repo.Setup(r => r.GetByIdAndUserIdAsync(id, TestUserId)).ReturnsAsync(MakeNegocio(id: id));
        repo.Setup(r => r.CountByUserIdAsync(TestUserId)).ReturnsAsync(1);

        var result = await CreateController(repo).DeleteNegocioById(id);

        var conflict = Assert.IsType<ConflictObjectResult>(result);
        Assert.Equal(409, conflict.StatusCode);
        repo.Verify(r => r.SoftDeleteAsync(It.IsAny<Guid>()), Times.Never);
    }

    [Fact]
    public async Task DeleteNegocioById_WithMoreThanOneActive_SoftDeletes()
    {
        var id = Guid.NewGuid();
        var repo = new Mock<INegocioRepository>();
        repo.Setup(r => r.GetByIdAndUserIdAsync(id, TestUserId)).ReturnsAsync(MakeNegocio(id: id));
        repo.Setup(r => r.CountByUserIdAsync(TestUserId)).ReturnsAsync(3);
        repo.Setup(r => r.SoftDeleteAsync(id)).Returns(Task.CompletedTask);

        var result = await CreateController(repo).DeleteNegocioById(id);

        Assert.IsType<NoContentResult>(result);
        repo.Verify(r => r.SoftDeleteAsync(id), Times.Once);
    }

    [Fact]
    public async Task DeleteNegocioById_AlreadyHidden_Returns400()
    {
        var id = Guid.NewGuid();
        var repo = new Mock<INegocioRepository>();
        repo.Setup(r => r.GetByIdAndUserIdAsync(id, TestUserId))
            .ReturnsAsync(MakeNegocio(id: id, estado: "oculto_usuario"));

        var result = await CreateController(repo).DeleteNegocioById(id);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal(400, bad.StatusCode);
    }

    [Fact]
    public async Task DeleteNegocioById_NotOwned_Returns404()
    {
        var id = Guid.NewGuid();
        var repo = new Mock<INegocioRepository>();
        repo.Setup(r => r.GetByIdAndUserIdAsync(id, TestUserId)).ReturnsAsync((NegocioEntity?)null);

        var result = await CreateController(repo).DeleteNegocioById(id);
        Assert.IsType<NotFoundResult>(result);
    }

    // ── POST /api/negocio/:id/restaurar ─────────────────────────────────────
    [Fact]
    public async Task RestoreNegocio_WithSlotFree_Returns200()
    {
        var id = Guid.NewGuid();
        var repo = new Mock<INegocioRepository>();
        repo.Setup(r => r.GetByIdAndUserIdAsync(id, TestUserId))
            .ReturnsAsync(MakeNegocio(id: id, estado: "oculto_usuario"));
        repo.Setup(r => r.CountByUserIdAsync(TestUserId)).ReturnsAsync(0);
        repo.Setup(r => r.RestoreAsync(id)).Returns(Task.CompletedTask);
        repo.Setup(r => r.GetByIdAsync(id)).ReturnsAsync(MakeNegocio(id: id));

        var usuario = new Mock<IUsuarioRepository>();
        usuario.Setup(u => u.GetByIdAsync(TestUserId))
            .ReturnsAsync(new UsuarioEntity { Id = TestUserId, Plan = "basic", LocalesContratados = 1 });

        var result = await CreateController(repo, usuario).RestoreNegocio(id);

        Assert.IsType<OkObjectResult>(result);
        repo.Verify(r => r.RestoreAsync(id), Times.Once);
    }

    [Fact]
    public async Task RestoreNegocio_NoSlotLeftBasicUser_Returns403SlotLimit()
    {
        var id = Guid.NewGuid();
        var repo = new Mock<INegocioRepository>();
        repo.Setup(r => r.GetByIdAndUserIdAsync(id, TestUserId))
            .ReturnsAsync(MakeNegocio(id: id, estado: "oculto_usuario"));
        repo.Setup(r => r.CountByUserIdAsync(TestUserId)).ReturnsAsync(1);

        var usuario = new Mock<IUsuarioRepository>();
        usuario.Setup(u => u.GetByIdAsync(TestUserId))
            .ReturnsAsync(new UsuarioEntity { Id = TestUserId, Plan = "basic", LocalesContratados = 1 });

        var result = await CreateController(repo, usuario).RestoreNegocio(id);

        var obj = Assert.IsType<ObjectResult>(result);
        Assert.Equal(403, obj.StatusCode);
        repo.Verify(r => r.RestoreAsync(It.IsAny<Guid>()), Times.Never);
    }

    [Fact]
    public async Task RestoreNegocio_ProBypassesSlotCheck()
    {
        var id = Guid.NewGuid();
        var repo = new Mock<INegocioRepository>();
        repo.Setup(r => r.GetByIdAndUserIdAsync(id, TestUserId))
            .ReturnsAsync(MakeNegocio(id: id, estado: "oculto_usuario"));
        repo.Setup(r => r.RestoreAsync(id)).Returns(Task.CompletedTask);
        repo.Setup(r => r.GetByIdAsync(id)).ReturnsAsync(MakeNegocio(id: id));

        var usuario = new Mock<IUsuarioRepository>();
        usuario.Setup(u => u.GetByIdAsync(TestUserId))
            .ReturnsAsync(new UsuarioEntity { Id = TestUserId, Plan = "pro", LocalesContratados = 1 });

        var result = await CreateController(repo, usuario).RestoreNegocio(id);

        Assert.IsType<OkObjectResult>(result);
        repo.Verify(r => r.CountByUserIdAsync(It.IsAny<Guid>()), Times.Never);
    }

    [Fact]
    public async Task RestoreNegocio_AlreadyActive_Returns400()
    {
        var id = Guid.NewGuid();
        var repo = new Mock<INegocioRepository>();
        repo.Setup(r => r.GetByIdAndUserIdAsync(id, TestUserId)).ReturnsAsync(MakeNegocio(id: id)); // estado activo

        var result = await CreateController(repo).RestoreNegocio(id);
        Assert.IsType<BadRequestObjectResult>(result);
    }

    // ── POST /api/negocio/:id/principal ─────────────────────────────────────
    [Fact]
    public async Task SetPrincipal_Success_Returns204()
    {
        var id = Guid.NewGuid();
        var repo = new Mock<INegocioRepository>();
        repo.Setup(r => r.GetByIdAndUserIdAsync(id, TestUserId)).ReturnsAsync(MakeNegocio(id: id));
        repo.Setup(r => r.SetPrincipalAsync(TestUserId, id)).Returns(Task.CompletedTask);

        var result = await CreateController(repo).SetPrincipal(id);

        Assert.IsType<NoContentResult>(result);
        repo.Verify(r => r.SetPrincipalAsync(TestUserId, id), Times.Once);
    }

    [Fact]
    public async Task SetPrincipal_OnHiddenNegocio_Returns400()
    {
        var id = Guid.NewGuid();
        var repo = new Mock<INegocioRepository>();
        repo.Setup(r => r.GetByIdAndUserIdAsync(id, TestUserId))
            .ReturnsAsync(MakeNegocio(id: id, estado: "oculto_usuario"));

        var result = await CreateController(repo).SetPrincipal(id);
        Assert.IsType<BadRequestObjectResult>(result);
    }

    // ── POST /api/negocio (create) ──────────────────────────────────────────
    [Fact]
    public async Task CreateNegocio_Success_ReturnsCreated()
    {
        var repo = new Mock<INegocioRepository>();
        var newId = Guid.NewGuid();
        repo.Setup(r => r.TryCreateAsync(TestUserId, It.IsAny<string>(), "Bar", null, null, null,
                It.IsAny<string>(), null, false))
            .ReturnsAsync(newId);
        repo.Setup(r => r.GetByIdAsync(newId)).ReturnsAsync(MakeNegocio(id: newId, nombre: "Bar"));

        var result = await CreateController(repo).CreateNegocio(new CreateNegocioRequest { Nombre = "Bar" });

        Assert.IsType<CreatedResult>(result);
    }

    [Fact]
    public async Task CreateNegocio_SlotLimitReached_Returns403()
    {
        var repo = new Mock<INegocioRepository>();
        repo.Setup(r => r.TryCreateAsync(
                TestUserId, It.IsAny<string>(), "Bar", null, null, null,
                It.IsAny<string>(), null, false))
            .ThrowsAsync(new SlotLimitReachedException("slot_limit_reached"));

        var result = await CreateController(repo).CreateNegocio(new CreateNegocioRequest { Nombre = "Bar" });

        var obj = Assert.IsType<ObjectResult>(result);
        Assert.Equal(403, obj.StatusCode);
    }

    [Fact]
    public async Task CreateNegocio_ProBypassesSlotGate()
    {
        var repo = new Mock<INegocioRepository>();
        var newId = Guid.NewGuid();
        repo.Setup(r => r.TryCreateAsync(TestUserId, It.IsAny<string>(), "Bar", null, null, null,
                It.IsAny<string>(), null, true))
            .ReturnsAsync(newId);
        repo.Setup(r => r.GetByIdAsync(newId)).ReturnsAsync(MakeNegocio(id: newId));

        var usuario = new Mock<IUsuarioRepository>();
        usuario.Setup(u => u.GetByIdAsync(TestUserId))
            .ReturnsAsync(new UsuarioEntity { Id = TestUserId, Plan = "pro", LocalesContratados = 1 });

        var result = await CreateController(repo, usuario).CreateNegocio(new CreateNegocioRequest { Nombre = "Bar" });

        Assert.IsType<CreatedResult>(result);
        repo.Verify(r => r.TryCreateAsync(TestUserId, It.IsAny<string>(), "Bar", null, null, null,
            It.IsAny<string>(), null, true), Times.Once);
    }

    [Fact]
    public async Task CreateNegocio_WithExistingHiddenPlaceId_Returns409ExisteOculto()
    {
        var placeId = "ChIJabc";
        var hiddenId = Guid.NewGuid();
        var repo = new Mock<INegocioRepository>();
        repo.Setup(r => r.GetHiddenByPlaceIdAsync(TestUserId, placeId))
            .ReturnsAsync(MakeNegocio(id: hiddenId, nombre: "Antiguo", estado: "oculto_usuario", placeId: placeId));

        var result = await CreateController(repo).CreateNegocio(new CreateNegocioRequest
        {
            Nombre = "Intento re-añadir",
            PlaceId = placeId,
        });

        var conflict = Assert.IsType<ConflictObjectResult>(result);
        Assert.Equal(409, conflict.StatusCode);
        repo.Verify(r => r.TryCreateAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
            It.IsAny<string>(), It.IsAny<string[]?>(), It.IsAny<bool>()), Times.Never);
    }

    // ── PUT /api/negocio/:id ────────────────────────────────────────────────
    [Fact]
    public async Task UpdateNegocioById_NotOwned_Returns404()
    {
        var id = Guid.NewGuid();
        var repo = new Mock<INegocioRepository>();
        repo.Setup(r => r.GetByIdAndUserIdAsync(id, TestUserId)).ReturnsAsync((NegocioEntity?)null);

        var result = await CreateController(repo).UpdateNegocioById(id, new UpdateNegocioRequest { Nombre = "x" });
        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task UpdateNegocioById_NonAdminChangingExistingPlaceId_Returns403()
    {
        // El place_id queda bloqueado tras el onboarding inicial: solo admin puede re-asignarlo.
        // Sin este gate, un usuario podría reasignar su local a otro Google Place y mezclar reseñas.
        var id = Guid.NewGuid();
        var existing = MakeNegocio(id: id, placeId: "ChIJprevio");
        var repo = new Mock<INegocioRepository>();
        repo.Setup(r => r.GetByIdAndUserIdAsync(id, TestUserId)).ReturnsAsync(existing);

        var result = await CreateController(repo).UpdateNegocioById(id, new UpdateNegocioRequest
        {
            PlaceId = "ChIJnuevo",
        });

        Assert.IsType<ForbidResult>(result);
        repo.Verify(r => r.UpdateAsync(It.IsAny<NegocioEntity>()), Times.Never);
    }

    [Fact]
    public async Task UpdateNegocioById_AdminCanOverrideExistingPlaceId()
    {
        // Admin bypass: ADMIN_USER_ID env puede cambiar place_id en casos de soporte.
        var adminId = Guid.NewGuid();
        Environment.SetEnvironmentVariable("ADMIN_USER_ID", adminId.ToString());

        var id = Guid.NewGuid();
        var existing = new NegocioEntity
        {
            Id = id,
            Nombre = "Bar",
            Codigo = "NEG1",
            IdUsuario = adminId,
            TonoPredefinido = "Cercano",
            PlaceId = "ChIJprevio",
            Estado = "activo",
        };
        var repo = new Mock<INegocioRepository>();
        repo.Setup(r => r.GetByIdAndUserIdAsync(id, adminId)).ReturnsAsync(existing);
        repo.Setup(r => r.UpdateAsync(It.IsAny<NegocioEntity>())).Returns(Task.CompletedTask);

        var logger = Mock.Of<ILogger<NegocioController>>();
        var usuarioRepo = new Mock<IUsuarioRepository>();
        var controller = new NegocioController(repo.Object, usuarioRepo.Object, logger);
        var claims = new[] { new Claim("sub", adminId.ToString()) };
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(claims, "Test")) },
        };

        var result = await controller.UpdateNegocioById(id, new UpdateNegocioRequest { PlaceId = "ChIJnuevo" });

        Assert.IsType<OkObjectResult>(result);
        repo.Verify(r => r.UpdateAsync(It.Is<NegocioEntity>(n => n.PlaceId == "ChIJnuevo")), Times.Once);

        // Restaurar env var para no contaminar otros tests
        Environment.SetEnvironmentVariable("ADMIN_USER_ID", "00000000-0000-0000-0000-000000000000");
    }

    [Fact]
    public async Task RestoreNegocio_NotOwned_Returns404()
    {
        // Ownership: sin este check un user podría restaurar el local oculto de otro usuario.
        var id = Guid.NewGuid();
        var repo = new Mock<INegocioRepository>();
        repo.Setup(r => r.GetByIdAndUserIdAsync(id, TestUserId)).ReturnsAsync((NegocioEntity?)null);

        var result = await CreateController(repo).RestoreNegocio(id);

        Assert.IsType<NotFoundResult>(result);
        repo.Verify(r => r.RestoreAsync(It.IsAny<Guid>()), Times.Never);
    }

    [Fact]
    public async Task SetPrincipal_NotOwned_Returns404()
    {
        // Ownership sobre POST /:id/principal. Sin esto la RPC se ejecutaría contra un id ajeno.
        var id = Guid.NewGuid();
        var repo = new Mock<INegocioRepository>();
        repo.Setup(r => r.GetByIdAndUserIdAsync(id, TestUserId)).ReturnsAsync((NegocioEntity?)null);

        var result = await CreateController(repo).SetPrincipal(id);

        Assert.IsType<NotFoundResult>(result);
        repo.Verify(r => r.SetPrincipalAsync(It.IsAny<Guid>(), It.IsAny<Guid>()), Times.Never);
    }

    [Fact]
    public async Task UpdateNegocioById_SetsUpdatedFields()
    {
        var id = Guid.NewGuid();
        var existing = MakeNegocio(id: id, nombre: "Bar Viejo");
        var repo = new Mock<INegocioRepository>();
        repo.Setup(r => r.GetByIdAndUserIdAsync(id, TestUserId)).ReturnsAsync(existing);
        repo.Setup(r => r.UpdateAsync(It.IsAny<NegocioEntity>())).Returns(Task.CompletedTask);

        var result = await CreateController(repo).UpdateNegocioById(id, new UpdateNegocioRequest
        {
            Nombre = "Bar Nuevo",
            TonoPredefinido = "Humoristico",
        });

        Assert.IsType<OkObjectResult>(result);
        repo.Verify(r => r.UpdateAsync(It.Is<NegocioEntity>(n =>
            n.Nombre == "Bar Nuevo" && n.TonoPredefinido == "Humoristico")), Times.Once);
    }

    // ── Scope header honrado ────────────────────────────────────────────────
    [Fact]
    public async Task CreateNegocio_ExistsHiddenPayloadContainsHiddenIdAndNombre()
    {
        // Smoke end-to-end: el 409 existe_oculto lleva los datos que el frontend necesita
        // para pintar el modal "Restaurar" (id + nombre). Sin esto, onboarding no sabría
        // qué restore ofrecer al usuario.
        var placeId = "ChIJtest";
        var hiddenId = Guid.NewGuid();
        var repo = new Mock<INegocioRepository>();
        repo.Setup(r => r.GetHiddenByPlaceIdAsync(TestUserId, placeId))
            .ReturnsAsync(MakeNegocio(id: hiddenId, nombre: "Bar Histórico", estado: "oculto_usuario", placeId: placeId));

        var result = await CreateController(repo).CreateNegocio(new CreateNegocioRequest
        {
            Nombre = "Bar nuevo intento",
            PlaceId = placeId,
        });

        var conflict = Assert.IsType<ConflictObjectResult>(result);
        var value = conflict.Value!.GetType().GetProperties()
            .ToDictionary(p => p.Name, p => p.GetValue(conflict.Value));
        Assert.Equal("existe_oculto", value["error"]);
        Assert.Equal(hiddenId, value["id"]);
        Assert.Equal("Bar Histórico", value["nombre"]);
    }

    // ── Legacy PUT /me ──────────────────────────────────────────────────────
    [Fact]
    public async Task UpdateMe_Legacy_UpdatesPrimary()
    {
        var repo = new Mock<INegocioRepository>();
        repo.Setup(r => r.GetByUserIdAsync(TestUserId))
            .ReturnsAsync(MakeNegocio(esPrincipal: true, nombre: "Primario"));
        repo.Setup(r => r.UpdateAsync(It.IsAny<NegocioEntity>())).Returns(Task.CompletedTask);

        var result = await CreateController(repo).UpdateNegocio(new UpdateNegocioRequest { Nombre = "Editado" });

        Assert.IsType<OkObjectResult>(result);
    }
}
