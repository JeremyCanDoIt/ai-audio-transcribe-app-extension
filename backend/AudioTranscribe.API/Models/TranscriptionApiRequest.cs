// AudioTranscribe.API/Models/TranscriptionApiRequest.cs
using System.ComponentModel.DataAnnotations;
using AudioTranscribe.Core.Models;

namespace AudioTranscribe.API.Models
{
    public class TranscriptionApiRequest
    {
        [Required]
        public IFormFile AudioFile { get; set; } = null!;

        // Language for transcription (optional - Whisper auto-detects if not provided)
        public string? Language { get; set; }

        // Target language for translation (e.g., "en", "es", "fr")
        // If provided, will translate the transcription to this language
        public string? TranslateTo { get; set; } 
        public int? SequenceNumber { get; set; }

        public string? TabTitle { get; set; }
        public string? TabUrl { get; set; }

        public async Task<TranscriptionRequest> ToCoreModelAsync()
        {
            using var memoryStream = new MemoryStream();
            await AudioFile.CopyToAsync(memoryStream);
            
            return new TranscriptionRequest
            {
                AudioData = memoryStream.ToArray(),
                FileName = AudioFile.FileName,
                ContentType = AudioFile.ContentType,
                Language = Language,
                TranslateTo = TranslateTo,
                SequenceNumber = SequenceNumber,
                TabTitle = TabTitle,
                TabUrl = TabUrl,
                Timestamp = DateTimeOffset.UtcNow
            };
        }
    }
}