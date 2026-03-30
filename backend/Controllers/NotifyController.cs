using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using backend.Models.Entities;
using backend.Services;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class NotifyController : ControllerBase
{
    private readonly EmailService _email;
    private readonly Supabase.Client _supabase;
    private readonly ILogger<NotifyController> _logger;

    public NotifyController(EmailService email, Supabase.Client supabase, ILogger<NotifyController> logger)
    {
        _email = email;
        _supabase = supabase;
        _logger = logger;
    }

    [HttpPost("waitlist")]
    public async Task<IActionResult> JoinWaitlist([FromBody] WaitlistRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Plan) ||
            (request.Plan != "core" && request.Plan != "pro"))
            return BadRequest("Plan inválido.");

        var userId = Guid.Parse(User.FindFirst("sub")!.Value);

        var usuarioResult = await _supabase.From<UsuarioEntity>()
            .Where(u => u.Id == userId).Limit(1).Get();
        var usuario = usuarioResult.Models.FirstOrDefault();

        var userEmail = usuario?.Email ?? "";
        var userName  = usuario?.Nombre ?? "";

        _logger.LogInformation("[NotifyController] Waitlist — userId={UserId}, plan={Plan}, email={Email}",
            userId, request.Plan, userEmail);

        await _email.SendWaitlistNotificationAsync(userEmail, userName, request.Plan, request.Notas ?? "");

        return Ok(new { ok = true });
    }
}

public record WaitlistRequest(string Plan, string? Notas);
