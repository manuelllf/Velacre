using DotNetEnv;
using backend.Infrastructure;
using backend.Interfaces;
using backend.Repositories;
using backend.Services;
using FluentValidation;
using FluentValidation.AspNetCore;
using Supabase;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Http.Resilience;
using Microsoft.IdentityModel.Tokens;
using Polly;

var builder = WebApplication.CreateBuilder(args);

Env.Load();

builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddHttpClient();
builder.Services.AddMemoryCache();

// Auth JWT — Supabase usa ES256 (asimétrico), validamos via JWKS discovery
var supabaseUrl = (Environment.GetEnvironmentVariable("SUPABASE_URL")
    ?? throw new InvalidOperationException("SUPABASE_URL no está configurado")).TrimEnd('/');

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = supabaseUrl + "/auth/v1";
        options.RequireHttpsMetadata = true;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero
        };
        options.MapInboundClaims = false;
    });
builder.Services.AddAuthorization();

// HttpClient con timeout + circuit breaker para Claude.
//
// Timeout 90s: sin esto el SDK usa default infinito y un outage de Claude
// puede saturar el thread pool del backend.
//
// Circuit breaker: si Claude empieza a fallar sostenidamente (outage real),
// tras N fallos el circuito se abre y las siguientes llamadas fallan al instante
// con BrokenCircuitException en vez de esperar 90s cada una. Con eso "generar
// respuesta" devuelve 500 al usuario rápido y el resto de la app (dashboard,
// settings, publicar, métricas) sigue funcionando porque no gastamos threads
// esperando a Claude. Se reintentan llamadas periódicas para cerrar el circuito
// automáticamente cuando Claude vuelve.
builder.Services.AddHttpClient("anthropic", c =>
{
    c.Timeout = TimeSpan.FromSeconds(90);
})
.AddResilienceHandler("claude-pipeline", pipeline =>
{
    // Circuit breaker: tras 50% fallos en ventana de 30s con mínimo 8 requests,
    // abre el circuito 30s. Valores conservadores — un poco de ruido no lo abre.
    pipeline.AddCircuitBreaker(new HttpCircuitBreakerStrategyOptions
    {
        SamplingDuration     = TimeSpan.FromSeconds(30),
        FailureRatio         = 0.5,
        MinimumThroughput    = 8,
        BreakDuration        = TimeSpan.FromSeconds(30),
    });

    // Timeout por intento (más corto que el timeout global del HttpClient)
    pipeline.AddTimeout(TimeSpan.FromSeconds(85));
});

builder.Services.AddScoped<IReviewAiService>(sp =>
{
    var factory = sp.GetRequiredService<IHttpClientFactory>();
    var http = factory.CreateClient("anthropic");
    return new ClaudeService(
        Environment.GetEnvironmentVariable("ANTHROPIC_API_KEY")!,
        http,
        sp.GetRequiredService<ILogger<ClaudeService>>());
});

builder.Services.AddHttpClient<IGooglePlacesService, GooglePlacesService>();
builder.Services.AddHttpClient<IOutscraperService, OutscraperService>();
builder.Services.AddHttpClient<IGoogleBusinessService, GoogleBusinessService>();
builder.Services.AddScoped<EmailService>();

// Repositories
builder.Services.AddScoped<IUsuarioRepository, UsuarioRepository>();
builder.Services.AddScoped<INegocioRepository, NegocioRepository>();
builder.Services.AddScoped<IReviewRepository, ReviewRepository>();
builder.Services.AddScoped<IGoogleConnectionRepository, GoogleConnectionRepository>();
builder.Services.AddScoped<ICompetidorRepository, CompetidorRepository>();
builder.Services.AddScoped<IRadarAnalisisRepository, RadarAnalisisRepository>();
builder.Services.AddScoped<IAnalisisIaRepository, AnalisisIaRepository>();

// FluentValidation
builder.Services.AddFluentValidationAutoValidation();
builder.Services.AddValidatorsFromAssemblyContaining<Program>();

builder.Services.AddSingleton<Supabase.Client>(sp =>
{
    var url = Environment.GetEnvironmentVariable("SUPABASE_URL")!;
    var key = Environment.GetEnvironmentVariable("SUPABASE_SERVICE_KEY")!;
    var options = new SupabaseOptions { AutoConnectRealtime = false };
    var client = new Supabase.Client(url, key, options);
    client.InitializeAsync().GetAwaiter().GetResult();
    return client;
});

var allowedOrigins = new[]
{
    "http://localhost:3000",
    "http://localhost:3001",
    "https://velacre.com",
    "https://www.velacre.com",
};

// Also allow any Vercel preview deploy (VERCEL_URL injected at runtime if needed)
var extraOrigin = Environment.GetEnvironmentVariable("CORS_EXTRA_ORIGIN");

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        var origins = string.IsNullOrWhiteSpace(extraOrigin)
            ? allowedOrigins
            : allowedOrigins.Append(extraOrigin).ToArray();
        policy.WithOrigins(origins)
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
    app.MapOpenApi();

app.UseCors("AllowFrontend");
app.UseMiddleware<GlobalExceptionMiddleware>();
app.UseAuthentication();
app.UseAuthorization();

app.Use(async (context, next) => {
    context.Request.EnableBuffering();
    await next();
});

app.MapControllers();

// Railway injects PORT; fallback to 5146 for local dev
var port = Environment.GetEnvironmentVariable("PORT") ?? "5146";
app.Run($"http://0.0.0.0:{port}");