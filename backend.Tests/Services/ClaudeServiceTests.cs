using System.Net;
using System.Text;
using backend.Services;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace backend.Tests.Services;

/// <summary>
/// Tests for ClaudeService — the AI service that generates review responses.
/// All tests use a FakeHttpMessageHandler to simulate Anthropic API responses
/// without making any real HTTP calls.
/// </summary>
public class ClaudeServiceTests
{
    private static ClaudeService CreateService(string jsonResponse)
    {
        // Build the Anthropic Messages API response envelope
        var anthropicResponse = $$"""
        {
            "id": "msg_test",
            "type": "message",
            "role": "assistant",
            "content": [{ "type": "text", "text": {{jsonResponse}} }],
            "model": "claude-sonnet-4-6",
            "stop_reason": "end_turn",
            "stop_sequence": null,
            "usage": { "input_tokens": 100, "output_tokens": 50 }
        }
        """;

        var handler = new FakeHttpMessageHandler(anthropicResponse);
        var httpClient = new HttpClient(handler)
        {
            BaseAddress = new Uri("https://api.anthropic.com")
        };
        var logger = Mock.Of<ILogger<ClaudeService>>();

        // "fake-key" — never hits real API
        return new ClaudeService("fake-key", httpClient, logger);
    }

    private static string EscapeJsonString(string s) =>
        System.Text.Json.JsonSerializer.Serialize(s);

    [Fact]
    public async Task GenerateSingleResponseWithContext_ValidJson_ParsesAllFields()
    {
        var innerJson = """
        {
            "respuesta": "Gracias por su reseña.",
            "contextoCliente": "El cliente elogia la comida.",
            "contextoRespuesta": "Se agradece la valoración.",
            "keywordsUsadas": ["asador", "carne"],
            "retenida": false,
            "motivoRetencion": null
        }
        """;
        var service = CreateService(EscapeJsonString(innerJson));

        var (response, ctxCliente, ctxResp, keywords, retenida, motivo) =
            await service.GenerateSingleResponseWithContextAsync(
                "Excelente comida", "Asador gallego", "profesional", "es",
                new[] { "asador", "carne" });

        Assert.Equal("Gracias por su reseña.", response);
        Assert.Equal("El cliente elogia la comida.", ctxCliente);
        Assert.Equal("Se agradece la valoración.", ctxResp);
        Assert.Equal(new[] { "asador", "carne" }, keywords);
        Assert.False(retenida);
        Assert.Equal("", motivo);
    }

    [Fact]
    public async Task GenerateSingleResponseWithContext_RetainedReview_ReturnsRetentionFlags()
    {
        var innerJson = """
        {
            "respuesta": null,
            "contextoCliente": "El cliente describe intoxicación.",
            "contextoRespuesta": "",
            "keywordsUsadas": [],
            "retenida": true,
            "motivoRetencion": "intoxicacion"
        }
        """;
        var service = CreateService(EscapeJsonString(innerJson));

        var (response, ctxCliente, _, keywords, retenida, motivo) =
            await service.GenerateSingleResponseWithContextAsync(
                "Me intoxiqué comiendo aquí", "Restaurante X", "profesional", "es");

        Assert.True(retenida);
        Assert.Equal("intoxicacion", motivo);
        Assert.Equal("", response);
        Assert.Equal("El cliente describe intoxicación.", ctxCliente);
        Assert.Empty(keywords);
    }

    [Fact]
    public async Task GenerateSingleResponseWithContext_MalformedJson_FallsBackToRawText()
    {
        // Claude returns plain text without JSON braces
        var rawText = "Aquí tienes una respuesta sin formato JSON";
        var service = CreateService(EscapeJsonString(rawText));

        var (response, ctxCliente, ctxResp, keywords, retenida, motivo) =
            await service.GenerateSingleResponseWithContextAsync(
                "Buena comida", "Bar X", "cercano", "es");

        Assert.Equal(rawText, response);
        Assert.Equal("", ctxCliente);
        Assert.Equal("", ctxResp);
        Assert.Empty(keywords);
        Assert.False(retenida);
        Assert.Equal("", motivo);
    }

    [Fact]
    public async Task GenerateSingleResponse_ToneCercano_ReturnsResponse()
    {
        var responseText = "¡Muchas gracias por tu visita!";
        var service = CreateService(EscapeJsonString(responseText));

        var result = await service.GenerateSingleResponseAsync(
            "Muy buen sitio", "Cafetería Y", "cercano");

        Assert.Equal(responseText, result);
    }

    [Fact]
    public async Task GenerateSingleResponse_ToneEmpatico_ReturnsResponse()
    {
        var responseText = "Lamentamos mucho tu experiencia.";
        var service = CreateService(EscapeJsonString(responseText));

        var result = await service.GenerateSingleResponseAsync(
            "Mala experiencia", "Hotel Z", "empatico");

        Assert.Equal(responseText, result);
    }

    [Fact]
    public async Task GenerateSingleResponse_ToneAgradecido_ReturnsResponse()
    {
        var responseText = "Es un placer saber que disfrutaste.";
        var service = CreateService(EscapeJsonString(responseText));

        var result = await service.GenerateSingleResponseAsync(
            "Todo perfecto", "Pizzería W", "agradecido");

        Assert.Equal(responseText, result);
    }

    [Fact]
    public async Task GenerateSingleResponse_ToneHumoristico_ReturnsResponse()
    {
        var responseText = "¡Nos alegramos de que te hayas reído y comido bien!";
        var service = CreateService(EscapeJsonString(responseText));

        var result = await service.GenerateSingleResponseAsync(
            "Genial ambiente", "Taberna V", "humoristico");

        Assert.Equal(responseText, result);
    }

    [Fact]
    public async Task GenerateSingleResponse_DefaultTone_ReturnsProfesional()
    {
        var responseText = "Agradecemos su valoración.";
        var service = CreateService(EscapeJsonString(responseText));

        var result = await service.GenerateSingleResponseAsync(
            "Buen servicio", "Clínica A", "profesional");

        Assert.Equal(responseText, result);
    }

    [Fact]
    public async Task GenerateSingleResponseWithContext_DiscriminationRetention_Works()
    {
        var innerJson = """
        {
            "respuesta": null,
            "contextoCliente": "El cliente acusa de discriminación.",
            "contextoRespuesta": "",
            "keywordsUsadas": [],
            "retenida": true,
            "motivoRetencion": "discriminacion"
        }
        """;
        var service = CreateService(EscapeJsonString(innerJson));

        var (_, _, _, _, retenida, motivo) =
            await service.GenerateSingleResponseWithContextAsync(
                "Me discriminaron por mi nacionalidad", "Restaurante B", "profesional", "es");

        Assert.True(retenida);
        Assert.Equal("discriminacion", motivo);
    }

    /// <summary>
    /// Fake HTTP handler that returns a pre-built response for any request.
    /// Never makes real HTTP calls.
    /// </summary>
    private class FakeHttpMessageHandler : HttpMessageHandler
    {
        private readonly string _responseBody;

        public FakeHttpMessageHandler(string responseBody)
        {
            _responseBody = responseBody;
        }

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var response = new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(_responseBody, Encoding.UTF8, "application/json")
            };
            return Task.FromResult(response);
        }
    }
}
