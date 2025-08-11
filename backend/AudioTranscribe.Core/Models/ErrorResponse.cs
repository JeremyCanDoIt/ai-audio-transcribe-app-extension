// AudioTranscribe.Core/Models/ErrorResponse.cs
namespace AudioTranscribe.Core.Models
{
    //Standardized error response for API
    public class ErrorResponse
    {
        /// Error code for programmatic handling
        public string Code { get; set; } = string.Empty;

        /// Human-readable error message
        public string Message { get; set; } = string.Empty;

        /// Detailed error information for debugging
        public string? Details { get; set; }

        /// Timestamp when error occurred
        public DateTimeOffset Timestamp { get; set; } = DateTimeOffset.UtcNow;

        /// Request ID for tracing
        public string? RequestId { get; set; }
    }
}