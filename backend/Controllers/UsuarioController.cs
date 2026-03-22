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

    public UsuarioController(Supabase.Client supabase, ILogger<UsuarioController> logger)
    {
        _supabase = supabase;
        _logger = logger;
    }

    [HttpPost]
    public async Task<IActionResult> CreateProfile([FromBody] CreateUsuarioRequest request)
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        _logger.LogInformation("[UsuarioController] POST / — userId={UserId}, nombre={Nombre}", userId, request.Nombre);

        var entity = new UsuarioEntity
        {
            Id = userId,
            Nombre = request.Nombre,
            Telefono = request.Telefono,
            CreadoPor = userId,
            CreadoFecha = DateTimeOffset.UtcNow
        };

        try
        {
            var result = await _supabase.From<UsuarioEntity>().Insert(entity);

            if (result.Models.Count == 0)
            {
                _logger.LogError("[UsuarioController] Insert devolvió 0 modelos para userId={UserId}", userId);
                return StatusCode(500, "No se pudo crear el perfil.");
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
