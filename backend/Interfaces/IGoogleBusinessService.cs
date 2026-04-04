using backend.Models;
using backend.Models.Entities;

namespace backend.Interfaces;

public interface IGoogleBusinessService
{
    /// <summary>Genera la URL de autorización OAuth de Google con state firmado</summary>
    string GenerateAuthUrl(Guid negocioId, Guid userId, string returnTo);

    /// <summary>Procesa el callback de Google: intercambia el code, guarda tokens, lista locales</summary>
    Task<GbpCallbackResult> HandleCallbackAsync(string code, string state);

    /// <summary>Lista los locales GBP disponibles para el negocio (usa el token pendiente)</summary>
    Task<List<GbpLocation>> GetLocationsAsync(Guid negocioId);

    /// <summary>Finaliza la conexión: guarda el local elegido, borra reseñas antiguas, lanza sync</summary>
    Task FinalizeConnectionAsync(Guid negocioId, Guid userId, string locationName, string displayName);

    /// <summary>Desconecta GBP: revoca token, borra la conexión y las reseñas del negocio</summary>
    Task DisconnectAsync(Guid negocioId, Guid userId);

    /// <summary>Devuelve la conexión activa del negocio, o null si no existe</summary>
    Task<GoogleConnectionEntity?> GetConnectionAsync(Guid negocioId);

    /// <summary>Sincroniza reseñas desde GBP API (reemplaza a Outscraper cuando GBP está conectado)</summary>
    Task<(int NewCount, int UpdatedCount)> SyncReviewsAsync(Guid negocioId, Guid userId);

    /// <summary>Publica una respuesta en Google y actualiza la reseña en BD</summary>
    Task<(bool Ok, string? Error)> PublishReplyAsync(Guid reviewId, Guid userId, string replyText);
}
