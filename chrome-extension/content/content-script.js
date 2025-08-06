// chrome-extension/content/content-script.js

// Simple content script - placeholder for now
// This runs on every web page but doesn't do much yet

console.log('Audio Transcribe content script loaded on:', window.location.hostname);

// We might use this later for:
// - Detecting audio elements on the page
// - Showing transcription overlays
// - Handling page-specific audio capture logic

// For now, just log that we're here
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('Audio Transcribe: Page loaded, ready for transcription');
    });
} else {
    console.log('Audio Transcribe: Page already loaded, ready for transcription');
}