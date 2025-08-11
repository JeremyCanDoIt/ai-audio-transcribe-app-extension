namespace AudioTranscribe.Core.Models
{
    // Response model containing transcribed text - simplified for default response.
    public class TranscriptionResponse
    {
        // The transcribed or translated text from the audio
        public string Text { get; set; } = string.Empty;

        // Whether this is a translation (to English) or transcription
        public bool IsTranslation { get; set; } = false;

        // Language that was detected/specified (for transcription)
        // Always "en" for translations
        public string? Language { get; set; }

        // Timestamp when transcription was completed
        public DateTimeOffset ProcessedAt { get; set; } = DateTimeOffset.UtcNow;

        // Processing time for this transcription
        public TimeSpan ProcessingTime { get; set; }

        // Echo back the sequence number for ordering
        public int? SequenceNumber { get; set; }

        // Size of the audio file that was processed (in bytes)
        public long AudioFileSize { get; set; }
    }
}
