// AudioTranscribe.API/Controllers/TranscriptionController.cs
using Microsoft.AspNetCore.Mvc;
using AudioTranscribe.Core.Models;
using AudioTranscribe.Infrastructure.Services;
using AudioTranscribe.API.Models;

namespace AudioTranscribe.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TranscriptionController : ControllerBase
    {
        private readonly OpenAIService _openAIService;
        private readonly ILogger<TranscriptionController> _logger;

        public TranscriptionController(OpenAIService openAIService, ILogger<TranscriptionController> logger)
        {
            _openAIService = openAIService;
            _logger = logger;
        }

        [HttpPost("transcribe")]
        public async Task<ActionResult<TranscriptionResponse>> Transcribe([FromForm] TranscriptionApiRequest request)
        {
            try
            {
                _logger.LogInformation("Received transcription request for file: {FileName}", request.AudioFile.FileName);

                // Validate the request
                if (request.AudioFile == null || request.AudioFile.Length == 0)
                {
                    return BadRequest(new ErrorResponse
                    {
                        Code = "INVALID_FILE",
                        Message = "Audio file is required and cannot be empty"
                    });
                }

                // Check file size (limit to 25MB for Whisper API)
                if (request.AudioFile.Length > 25 * 1024 * 1024)
                {
                    return BadRequest(new ErrorResponse
                    {
                        Code = "FILE_TOO_LARGE",
                        Message = "Audio file must be smaller than 25MB"
                    });
                }

                _logger.LogInformation("Audio file size: {Size} bytes", request.AudioFile.Length);

                // Process transcription directly with IFormFile
                var startTime = DateTime.UtcNow;
                var response = await _openAIService.TranscribeAsync(request);
                var processingTime = DateTime.UtcNow - startTime;

                // Set processing metrics
                response.ProcessingTime = processingTime;
                response.SequenceNumber = request.SequenceNumber;
                response.AudioFileSize = request.AudioFile.Length;

                _logger.LogInformation("Transcription completed in {ProcessingTime}ms for sequence {SequenceNumber}", 
                    processingTime.TotalMilliseconds, request.SequenceNumber);

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing transcription request");
                
                return StatusCode(500, new ErrorResponse
                {
                    Code = "TRANSCRIPTION_ERROR",
                    Message = "An error occurred while processing the transcription",
                    Details = ex.Message
                });
            }
        }

        [HttpGet("health")]
        public ActionResult<object> Health()
        {
            return Ok(new
            {
                Status = "Healthy",
                Timestamp = DateTimeOffset.UtcNow,
                Version = "1.0.0"
            });
        }

        [HttpGet("languages")]
        public ActionResult<object> GetSupportedLanguages()
        {
            var languages = new[]
            {
                new { Code = "auto", Name = "Auto-detect" },
                new { Code = "en", Name = "English" },
                new { Code = "es", Name = "Spanish" },
                new { Code = "fr", Name = "French" },
                new { Code = "de", Name = "German" },
                new { Code = "it", Name = "Italian" },
                new { Code = "pt", Name = "Portuguese" },
                new { Code = "ru", Name = "Russian" },
                new { Code = "ja", Name = "Japanese" },
                new { Code = "ko", Name = "Korean" },
                new { Code = "zh", Name = "Chinese" }
            };

            return Ok(languages);
        }
    }
}