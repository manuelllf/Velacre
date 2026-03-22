using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using backend.Models.Entities;
using backend.Models.Requests;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class NegocioController : ControllerBase
{
    private readonly Supabase.Client _supabase;

    public NegocioController(Supabase.Client supabase)
    {
        _supabase = supabase;
    }

    [HttpGet("me")]
    public async Task<IActionResult> GetMyNegocio()
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);

        var negocio = await _supabase.From<NegocioEntity>()
            .Where(n => n.IdUsuario == userId)
            .Single();

        if (negocio == null)
            return NotFound();

        return Ok(negocio);
    }

    [HttpPost]
    public async Task<IActionResult> CreateNegocio([FromBody] CreateNegocioRequest request)
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);

        var entity = new NegocioEntity
        {
            CIF = request.CIF,
            Nombre = request.Nombre,
            Email = request.Email,
            Telefono = request.Telefono,
            Descripcion = request.Descripcion,
            TonoPredefinido = request.TonoPredefinido ?? "Profesional",
            IdUsuario = userId,
            CreadoPor = userId,
            CreadoFecha = DateTimeOffset.UtcNow
        };

        var result = await _supabase.From<NegocioEntity>().Insert(entity);

        if (result.Models.Count == 0)
            return StatusCode(500, "No se pudo crear el negocio.");

        return Created("", result.Models[0]);
    }

    [HttpPut("me")]
    public async Task<IActionResult> UpdateNegocio([FromBody] UpdateNegocioRequest request)
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);

        var negocio = await _supabase.From<NegocioEntity>()
            .Where(n => n.IdUsuario == userId)
            .Single();

        if (negocio == null)
            return NotFound();

        negocio.Nombre = request.Nombre ?? negocio.Nombre;
        negocio.Email = request.Email ?? negocio.Email;
        negocio.Telefono = request.Telefono ?? negocio.Telefono;
        negocio.Descripcion = request.Descripcion ?? negocio.Descripcion;
        negocio.TonoPredefinido = request.TonoPredefinido ?? negocio.TonoPredefinido;
        negocio.ActualizadoPor = userId;
        negocio.ActualizadoFecha = DateTimeOffset.UtcNow;

        await _supabase.From<NegocioEntity>().Update(negocio);

        return Ok(negocio);
    }
}
