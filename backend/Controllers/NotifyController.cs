using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using backend.Interfaces;
using backend.Services;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class NotifyController : ControllerBase
{
    private readonly EmailService _email;
    private readonly IUsuarioRepository _usuarioRepo;
    private readonly ILogger<NotifyController> _logger;

    public NotifyController(EmailService email, IUsuarioRepository usuarioRepo, ILogger<NotifyController> logger)
    {
        _email = email;
        _usuarioRepo = usuarioRepo;
        _logger = logger;
    }

    [HttpPost("waitlist")]
    public async Task<IActionResult> JoinWaitlist([FromBody] WaitlistRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Plan) ||
            (request.Plan != "core" && request.Plan != "pro"))
            return BadRequest("Plan inválido.");

        var userId = Guid.Parse(User.FindFirst("sub")!.Value);

        var usuario = await _usuarioRepo.GetByIdAsync(userId);

        var userEmail = usuario?.Email ?? "";
        var userName  = usuario?.Nombre ?? "";

        _logger.LogInformation("[NotifyController] Waitlist — userId={UserId}, plan={Plan}, email={Email}",
            userId, request.Plan, userEmail);

        await _email.SendWaitlistNotificationAsync(userEmail, userName, request.Plan, request.Notas ?? "");

        return Ok(new { ok = true });
    }
}

public record WaitlistRequest(string Plan, string? Notas);
