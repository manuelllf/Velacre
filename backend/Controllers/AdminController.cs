using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using backend.Models.Entities;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AdminController : ControllerBase
{
    private readonly Supabase.Client _supabase;
    private readonly ILogger<AdminController> _logger;
    private readonly Guid _adminUserId;

    public AdminController(Supabase.Client supabase, ILogger<AdminController> logger)
    {
        _supabase = supabase;
        _logger = logger;
        _adminUserId = Guid.Parse(Environment.GetEnvironmentVariable("ADMIN_USER_ID") ?? "00000000-0000-0000-0000-000000000000");
    }

    private bool IsAdmin() => Guid.Parse(User.FindFirst("sub")!.Value) == _adminUserId;

    [HttpGet("usuarios")]
    public async Task<IActionResult> GetUsuarios()
    {
        if (!IsAdmin()) return Forbid();

        var usuariosResult = await _supabase.From<UsuarioEntity>().Get();
        var negociosResult = await _supabase.From<NegocioEntity>().Get();

        var negocios = negociosResult.Models
            .Where(n => n.IdUsuario.HasValue)
            .GroupBy(n => n.IdUsuario!.Value)
            .ToDictionary(g => g.Key, g => g.First());

        var data = usuariosResult.Models
            .OrderBy(u => u.CreadoFecha)
            .Select(u => new
            {
                id = u.Id,
                nombre = u.Nombre,
                email = u.Email,
                activo = u.Activo,
                activoDesde = u.ActivoDesde,
                creadoFecha = u.CreadoFecha,
                negocio = negocios.TryGetValue(u.Id, out var n) ? (object)new { id = n.Id, nombre = n.Nombre } : null
            });

        return Ok(data);
    }

    [HttpPost("usuarios/{id}/activar")]
    public async Task<IActionResult> Activar(Guid id)
    {
        if (!IsAdmin()) return Forbid();

        var result = await _supabase.From<UsuarioEntity>().Where(u => u.Id == id).Limit(1).Get();
        var usuario = result.Models.FirstOrDefault();
        if (usuario == null) return NotFound();

        usuario.Activo = true;
        if (usuario.ActivoDesde == null) usuario.ActivoDesde = DateTimeOffset.UtcNow;

        await _supabase.From<UsuarioEntity>().Where(u => u.Id == id).Update(usuario);
        _logger.LogInformation("[AdminController] Usuario {UserId} activado", id);
        return Ok();
    }

    [HttpPost("usuarios/{id}/desactivar")]
    public async Task<IActionResult> Desactivar(Guid id)
    {
        if (!IsAdmin()) return Forbid();

        var result = await _supabase.From<UsuarioEntity>().Where(u => u.Id == id).Limit(1).Get();
        var usuario = result.Models.FirstOrDefault();
        if (usuario == null) return NotFound();

        usuario.Activo = false;

        await _supabase.From<UsuarioEntity>().Where(u => u.Id == id).Update(usuario);
        _logger.LogInformation("[AdminController] Usuario {UserId} desactivado", id);
        return Ok();
    }
}
