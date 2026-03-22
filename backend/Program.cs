using DotNetEnv;
using backend.Interfaces;
using backend.Services;

var builder = WebApplication.CreateBuilder(args);

// 1. Cargar Variables de Entorno (.env)
Env.Load();

builder.Services.AddControllers();
builder.Services.AddOpenApi();

// 2. Inyectar el Servicio de IA
builder.Services.AddScoped<IReviewAiService>(sp => 
    new ClaudeService(Environment.GetEnvironmentVariable("ANTHROPIC_API_KEY")!));

// 3. Configurar CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
        policy.WithOrigins("http://localhost:3000")
              .AllowAnyMethod()
              .AllowAnyHeader());
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("AllowFrontend");
app.UseAuthorization();
app.MapControllers();

app.Run();