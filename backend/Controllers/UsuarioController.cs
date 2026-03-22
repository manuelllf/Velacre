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

    public UsuarioController(Supabase.Client supabase)
    {
        _supabase = supabase;
    }

    [HttpPost]
    public async Task<IActionResult> CreateProfile([FromBody] CreateUsuarioRequest request)
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);

        var entity = new UsuarioEntity
        {
            Id = userId,
            Nombre = request.Nombre,
            Telefono = request.Telefono,
            CreadoPor = userId,
            CreadoFecha = DateTimeOffset.UtcNow
        };

        var result = await _supabase.From<UsuarioEntity>().Insert(entity);

        if (result.Models.Count == 0)
            return StatusCode(500, "No se pudo crear el perfil.");

        return Created("", result.Models[0]);
    }
}
