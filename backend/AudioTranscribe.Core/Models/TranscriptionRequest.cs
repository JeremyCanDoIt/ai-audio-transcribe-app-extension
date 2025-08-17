using System.ComponentModel.DataAnnotations;
namespace AudioTranscribe.Core.Models
{

    //Represents a single request from chrome extension



    public class TranscriptionRequest
    {
        //The audio file to transcribe.
        [Required]
        public byte[] AudioData { get; set; } = Array.Empty<byte>();

        public string FileName { get; set; } = "audio.webm";

        public string ContentType { get; set; } = "audio/webm";

        //Language for transcription. Passed from form eventually. Rn use auto
        public string Language { get; set; } = "auto";


        //Target langyage for translations

        public string? TranslateTo { get; set; }

        // timestamp when the audio chunk was captured.
        public System.DateTimeOffset Timestamp { get; set; } = DateTimeOffset.UtcNow;

        //Represents sequence number of chunk for order
        public int? SequenceNumber { get; set; }
        

        //Tab information for context.
        public string? TabTitle { get; set; }
        public string? TabUrl { get; set; }

    }


}