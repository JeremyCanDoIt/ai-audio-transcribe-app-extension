// AudioTranscribe.Infrastructure/Services/OpenAIService.cs
using System.Text.Json;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Logging;
using AudioTranscribe.Core.Models;
using AudioTranscribe.Infrastructure.Configuration;
using AudioTranscribe.Infrastructure.Models;
using Microsoft.AspNetCore.Http;

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

            // Make sure BaseUrl ends with a slash for proper URL joining
            var baseUrl = _settings.BaseUrl.TrimEnd('/') + "/";
            _httpClient.BaseAddress = new Uri(baseUrl);
            _httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {_settings.ApiKey}");
            _httpClient.Timeout = TimeSpan.FromSeconds(_settings.TimeoutSeconds);

            // Debug: Log the Authorization header to make sure it's set
            _logger.LogInformation("Authorization header set: {HasAuth}", 
                _httpClient.DefaultRequestHeaders.Contains("Authorization") ? "YES" : "NO");
            
            _logger.LogInformation("Base URL set to: {BaseUrl}", _httpClient.BaseAddress);
            
            if (_httpClient.DefaultRequestHeaders.Contains("Authorization"))
            {
                var authHeader = _httpClient.DefaultRequestHeaders.GetValues("Authorization").FirstOrDefault();
                _logger.LogInformation("Auth header value: {AuthValue}", 
                    authHeader?.StartsWith("Bearer sk-") == true ? "Bearer sk-***" : "INVALID FORMAT");
            }
        }

        public async Task<TranscriptionResponse> TranscribeAsync(dynamic request)
        {
            var startTime = DateTime.UtcNow;
            
            try
            {
                IFormFile audioFile = request.AudioFile;
                string? language = request.Language;
                string? translateTo = request.TranslateTo;
                int? sequenceNumber = request.SequenceNumber;

                _logger.LogInformation("Starting transcription for {FileName} ({FileSize} bytes)", 
                    audioFile.FileName, audioFile.Length);

                // Convert IFormFile to byte array
                byte[] audioBytes;
                using (var memoryStream = new MemoryStream())
                {
                    await audioFile.CopyToAsync(memoryStream);
                    audioBytes = memoryStream.ToArray();
                }

                _logger.LogInformation("Audio bytes length: {Length}", audioBytes.Length);

                string resultText;
                bool isTranslation = false;
                string? resultLanguage = language;

                if (!string.IsNullOrEmpty(translateTo) && translateTo == "en")
                {
                    resultText = await GetTranslationAsync(audioBytes, audioFile.FileName, audioFile.ContentType);
                    isTranslation = true;
                    resultLanguage = "en";
                }
                else
                {
                    resultText = await GetTranscriptionAsync(audioBytes, audioFile.FileName, audioFile.ContentType, language);
                }
                
                var processingTime = DateTime.UtcNow - startTime;
                
                _logger.LogInformation("Processing completed in {ProcessingTime}ms", processingTime.TotalMilliseconds);

                return new TranscriptionResponse
                {
                    Text = resultText,
                    IsTranslation = isTranslation,
                    Language = resultLanguage,
                    ProcessedAt = DateTimeOffset.UtcNow,
                    ProcessingTime = processingTime,
                    SequenceNumber = sequenceNumber,
                    AudioFileSize = audioFile.Length
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during transcription");
                throw;
            }
        }

        private async Task<string> GetTranscriptionAsync(byte[] audioBytes, string fileName, string contentType, string? language)
        {
            using var content = new MultipartFormDataContent();
            
            // Just add the raw audio bytes
            var audioContent = new ByteArrayContent(audioBytes);
            audioContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(contentType);
            content.Add(audioContent, "file", fileName);
            
            // Add required model parameter
            content.Add(new StringContent(_settings.Model), "model");
            
            // Add language if provided
            if (!string.IsNullOrEmpty(language))
            {
                content.Add(new StringContent(language), "language");
            }
            
            // Request JSON response
            content.Add(new StringContent("json"), "response_format");

            _logger.LogInformation("Sending to OpenAI: model={Model}, language={Language}", _settings.Model, language ?? "auto");

            // Remove leading slash - HttpClient will combine BaseAddress + relative URL
            var response = await _httpClient.PostAsync("audio/transcriptions", content);
            
            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                _logger.LogError("OpenAI API error: {StatusCode} - {Error}", response.StatusCode, errorContent);
                throw new HttpRequestException($"OpenAI API error: {response.StatusCode} - {errorContent}");
            }

            var jsonResponse = await response.Content.ReadAsStringAsync();
            _logger.LogInformation("OpenAI response: {Response}", jsonResponse);
            
            var result = JsonSerializer.Deserialize<OpenAITranscriptionResponse>(jsonResponse, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });
            
            return result?.Text ?? string.Empty;
        }

        private async Task<string> GetTranslationAsync(byte[] audioBytes, string fileName, string contentType)
        {
            using var content = new MultipartFormDataContent();
            
            // Just add the raw audio bytes
            var audioContent = new ByteArrayContent(audioBytes);
            audioContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(contentType);
            content.Add(audioContent, "file", fileName);
            
            // Add required model parameter
            content.Add(new StringContent(_settings.Model), "model");
            
            // Request JSON response
            content.Add(new StringContent("json"), "response_format");

            _logger.LogInformation("Sending to OpenAI translation endpoint");

            // Remove leading slash - HttpClient will combine BaseAddress + relative URL
            var response = await _httpClient.PostAsync("audio/translations", content);
            
            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                _logger.LogError("OpenAI translation API error: {StatusCode} - {Error}", response.StatusCode, errorContent);
                throw new HttpRequestException($"OpenAI translation API error: {response.StatusCode} - {errorContent}");
            }

            var jsonResponse = await response.Content.ReadAsStringAsync();
            _logger.LogInformation("OpenAI translation response: {Response}", jsonResponse);
            
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