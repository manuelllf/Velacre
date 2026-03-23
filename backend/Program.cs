using DotNetEnv;
using backend.Interfaces;
using backend.Services;
using Supabase;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

Env.Load();

builder.Services.AddControllers();
builder.Services.AddOpenApi();

// Auth JWT — valida con SUPABASE_JWT_SECRET (HS256, UTF-8 bytes)
var jwtSecretRaw = Environment.GetEnvironmentVariable("SUPABASE_JWT_SECRET")
    ?? throw new InvalidOperationException("SUPABASE_JWT_SECRET no está configurado");
var jwtKeyBytes = System.Text.Encoding.UTF8.GetBytes(jwtSecretRaw);
var jwtSigningKey = new SymmetricSecurityKey(jwtKeyBytes);

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = jwtSigningKey,
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero
        };
        options.MapInboundClaims = false;
    });
builder.Services.AddAuthorization();

builder.Services.AddScoped<IReviewAiService>(sp =>
    new ClaudeService(
        Environment.GetEnvironmentVariable("ANTHROPIC_API_KEY")!,
        sp.GetRequiredService<ILogger<ClaudeService>>()));

builder.Services.AddHttpClient<IGooglePlacesService, GooglePlacesService>();
builder.Services.AddHttpClient<IOutscraperService, OutscraperService>();

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