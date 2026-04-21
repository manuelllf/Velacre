namespace backend.Models.Responses;

public sealed record RadarCompetidorAnalisis(
    string Nombre,
    string Fortaleza,
    string Debilidad,
    string Amenaza
);

public sealed record RadarRivalScore(
    string Nombre,
    double Score
);

public sealed record RadarCategoria(
    string Nombre,
    double Yo,
    RadarRivalScore[] Rivales,
    string Insight
);

public sealed record RadarAnalysis(
    string TuFortaleza,
    string TuDebilidad,
    RadarCompetidorAnalisis[] Competidores,
    string[] Oportunidades,
    string Accion,
    RadarCategoria[] Categorias,
    string AccionPro
);
