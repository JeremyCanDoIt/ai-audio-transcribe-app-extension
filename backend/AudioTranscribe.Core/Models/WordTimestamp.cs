// AudioTranscribe.Core/Models/WordTimestamp.cs

//not used for now because not calling verbose
namespace AudioTranscribe.Core.Models
{
    //Word-level timestamp information from Whisper API
    // Useful for precise synchronization with audio
    public class WordTimestamp
    {
        //The word or token
        public string Word { get; set; } = string.Empty;

        //Start time in seconds from beginning of audio
        public double Start { get; set; }

        //End time in seconds from beginning of audio
        public double End { get; set; }

        //Confidence score for this specific word
        public double Confidence { get; set; }
    }
}
