namespace backend.Models.Responses;

public sealed record MiniRadarOportunidad(
    string Titulo,
    string Descripcion,
    string[] Ejemplos
);

public sealed record MiniRadarAnalysis(
    string[] Fortalezas,
    string[] Debilidades,
    string Accion,
    string Resumen,
    string EmailPitch,
    MiniRadarOportunidad? Oportunidad
);
