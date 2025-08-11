// AudioTranscribe.API/Models/TranscriptionApiRequest.cs
using System.ComponentModel.DataAnnotations;

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
        public string? TranslateTo { get; set; } = "en"; // Default to English for now

        public int? SequenceNumber { get; set; }

        public string? TabTitle { get; set; }
        public string? TabUrl { get; set; }
    }
}