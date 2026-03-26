using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using backend.Models.Entities;
using backend.Models.Requests;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UsuarioController : ControllerBase
{
    private readonly Supabase.Client _supabase;
    private readonly ILogger<UsuarioController> _logger;
    private readonly Guid _adminUserId;

    public UsuarioController(Supabase.Client supabase, ILogger<UsuarioController> logger)
    {
        _supabase = supabase;
        _logger = logger;
        _adminUserId = Guid.Parse(Environment.GetEnvironmentVariable("ADMIN_USER_ID") ?? "00000000-0000-0000-0000-000000000000");
    }

    [HttpGet("me")]
    public async Task<IActionResult> GetMe()
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        var result = await _supabase.From<UsuarioEntity>()
            .Where(u => u.Id == userId)
            .Limit(1)
            .Get();
        var usuario = result.Models.FirstOrDefault();
        if (usuario == null) return NotFound();
        var isAdmin = userId == _adminUserId;
        // El rol efectivo es "admin" si coincide con ADMIN_USER_ID, si no, el del registro
        var rolEfectivo = isAdmin ? "admin" : usuario.Rol;
        return Ok(new
        {
            id = usuario.Id,
            nombre = usuario.Nombre,
            telefono = usuario.Telefono,
            activo = usuario.Activo,
            activoDesde = usuario.ActivoDesde,
            isAdmin,
            rol = rolEfectivo,
            plan = usuario.Plan
        });
    }

    [HttpPut("me")]
    public async Task<IActionResult> UpdateMe([FromBody] CreateUsuarioRequest request)
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        var result = await _supabase.From<UsuarioEntity>()
            .Where(u => u.Id == userId)
            .Limit(1)
            .Get();
        var usuario = result.Models.FirstOrDefault();
        if (usuario == null) return NotFound();

        usuario.Nombre = request.Nombre ?? usuario.Nombre;
        usuario.Telefono = request.Telefono ?? usuario.Telefono;
        usuario.ActualizadoPor = userId;
        usuario.ActualizadoFecha = DateTimeOffset.UtcNow;

        await _supabase.From<UsuarioEntity>().Where(u => u.Id == userId).Update(usuario);
        _logger.LogInformation("[UsuarioController] Perfil actualizado para userId={UserId}", userId);
        return Ok(new { id = usuario.Id, nombre = usuario.Nombre, telefono = usuario.Telefono });
    }

    [HttpPost]
    public async Task<IActionResult> CreateProfile([FromBody] CreateUsuarioRequest request)
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        var email = User.FindFirst("email")?.Value;
        _logger.LogInformation("[UsuarioController] POST / — userId={UserId}, nombre={Nombre}", userId, request.Nombre);

        var entity = new UsuarioEntity
        {
            Id = userId,
            Nombre = request.Nombre,
            Telefono = request.Telefono,
            Email = email,
            Activo = true,
            ActivoDesde = DateTimeOffset.UtcNow,
            Plan = "basic",
            CreadoPor = userId,
            CreadoFecha = DateTimeOffset.UtcNow
        };

        try
        {
            var result = await _supabase.From<UsuarioEntity>().Insert(entity);

            if (result.Models.Count == 0)
            {
                _logger.LogWarning("[UsuarioController] Insert devolvió 0 modelos para userId={UserId} (puede ser normal en Supabase)", userId);
            }

            _logger.LogInformation("[UsuarioController] Perfil creado para userId={UserId}", userId);
            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[UsuarioController] Error al crear perfil para userId={UserId}", userId);
            return StatusCode(500, ex.Message);
        }
    }
}
