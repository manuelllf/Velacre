namespace backend.Models;

/// <summary>Local de Google Business Profile disponible para seleccionar</summary>
public record GbpLocation(string LocationName, string DisplayName, string AccountId);

/// <summary>Resultado del callback OAuth de Google</summary>
public record GbpCallbackResult(
    bool Success,
    string? Error,
    bool AutoSelected,
    List<GbpLocation> Locations,
    string RedirectUrl
);
