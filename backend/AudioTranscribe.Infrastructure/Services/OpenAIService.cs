// AudioTranscribe.Infrastructure/Services/OpenAIService.cs
using System.Text.Json;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Logging;
using AudioTranscribe.Core.Models;
using AudioTranscribe.Infrastructure.Configuration;
using AudioTranscribe.Infrastructure.Models;

namespace AudioTranscribe.Infrastructure.Services
{
    public class OpenAIService
    {
        private readonly HttpClient _httpClient;
        private readonly OpenAISettings _settings;
        private readonly ILogger<OpenAIService> _logger;

        public OpenAIService(HttpClient httpClient, IOptions<OpenAISettings> settings, ILogger<OpenAIService> logger)
        {
            _httpClient = httpClient;
            _settings = settings.Value;
            _logger = logger;

            _httpClient.BaseAddress = new Uri(_settings.BaseUrl);
            _httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {_settings.ApiKey}");
            _httpClient.Timeout = TimeSpan.FromSeconds(_settings.TimeoutSeconds);
        }

        public async Task<TranscriptionResponse> TranscribeAsync(TranscriptionRequest request)
        {
            var startTime = DateTime.UtcNow;
            
            try
            {
                _logger.LogInformation("Starting transcription for {FileName} ({FileSize} bytes)", 
                    request.FileName, request.AudioData.Length);

                string resultText;
                bool isTranslation = false;
                string? language = request.Language;

                // If translation is requested, use translation endpoint
                if (!string.IsNullOrEmpty(request.TranslateTo))
                {
                    if (request.TranslateTo == "en")
                    {
                        resultText = await GetTranslationAsync(request);
                        isTranslation = true;
                        language = "en";
                    }
                    else
                    {
                        // TODO: Add support for other target languages using different translation service
                        _logger.LogInformation("Translation to {Language} not yet implemented, using transcription instead", request.TranslateTo);
                        resultText = await GetTranscriptionAsync(request);
                    }
                }
                else
                {
                    // Just transcribe in original language
                    resultText = await GetTranscriptionAsync(request);
                }
                
                var processingTime = DateTime.UtcNow - startTime;
                
                _logger.LogInformation("Processing completed in {ProcessingTime}ms", processingTime.TotalMilliseconds);

                return new TranscriptionResponse
                {
                    Text = resultText,
                    IsTranslation = isTranslation,
                    Language = language,
                    ProcessedAt = DateTimeOffset.UtcNow,
                    ProcessingTime = processingTime,
                    SequenceNumber = request.SequenceNumber,
                    AudioFileSize = request.AudioData.Length
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during transcription");
                throw;
            }
        }

        private async Task<string> GetTranscriptionAsync(TranscriptionRequest request)
        {
            using var content = new MultipartFormDataContent();
            
            var audioContent = new ByteArrayContent(request.AudioData);
            audioContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(request.ContentType);
            content.Add(audioContent, "file", request.FileName);
            
            content.Add(new StringContent(_settings.Model), "model");
            
            if (!string.IsNullOrEmpty(request.Language))
            {
                content.Add(new StringContent(request.Language), "language");
            }
            
            content.Add(new StringContent("json"), "response_format");

            var response = await _httpClient.PostAsync("/audio/transcriptions", content);
            
            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                var errorResponse = await TryParseErrorResponseAsync(errorContent);
                throw new HttpRequestException($"OpenAI API error: {response.StatusCode} - {errorResponse?.Error?.Message ?? errorContent}");
            }

            var jsonResponse = await response.Content.ReadAsStringAsync();
            var result = JsonSerializer.Deserialize<OpenAITranscriptionResponse>(jsonResponse, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });
            
            return result?.Text ?? string.Empty;
        }

        private async Task<string> GetTranslationAsync(TranscriptionRequest request)
        {
            using var content = new MultipartFormDataContent();
            
            var audioContent = new ByteArrayContent(request.AudioData);
            audioContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(request.ContentType);
            content.Add(audioContent, "file", request.FileName);
            
            content.Add(new StringContent(_settings.Model), "model");
            content.Add(new StringContent("json"), "response_format");

            var response = await _httpClient.PostAsync("/audio/translations", content);
            
            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                var errorResponse = await TryParseErrorResponseAsync(errorContent);
                throw new HttpRequestException($"OpenAI translation API error: {response.StatusCode} - {errorResponse?.Error?.Message ?? errorContent}");
            }

            var jsonResponse = await response.Content.ReadAsStringAsync();
            var result = JsonSerializer.Deserialize<OpenAITranscriptionResponse>(jsonResponse, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });
            
            return result?.Text ?? string.Empty;
        }

        private async Task<OpenAIErrorResponse?> TryParseErrorResponseAsync(string errorContent)
        {
            try
            {
                return JsonSerializer.Deserialize<OpenAIErrorResponse>(errorContent, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });
            }
            catch
            {
                return null;
            }
        }
    }
}