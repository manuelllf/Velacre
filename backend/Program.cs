using DotNetEnv;
using backend.Interfaces;
using backend.Services;
using Supabase;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

Env.Load();

builder.Services.AddControllers();
builder.Services.AddOpenApi();

// Auth JWT (valida tokens de Supabase Auth)
var jwtSecret = Environment.GetEnvironmentVariable("SUPABASE_JWT_SECRET")!;
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
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

builder.Services.AddSingleton<Supabase.Client>(sp =>
{
    var url = Environment.GetEnvironmentVariable("SUPABASE_URL")!;
    var key = Environment.GetEnvironmentVariable("SUPABASE_SERVICE_KEY")!;
    var options = new SupabaseOptions { AutoConnectRealtime = false };
    var client = new Supabase.Client(url, key, options);
    client.InitializeAsync().GetAwaiter().GetResult();
    return client;
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
        policy.WithOrigins("http://localhost:3000", "http://localhost:3001")
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials());
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
    app.MapOpenApi();

app.UseCors("AllowFrontend");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();