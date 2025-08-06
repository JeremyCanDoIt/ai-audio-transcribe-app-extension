// chrome-extension/background/service-worker.js

// Minimal service worker for Manifest V3
// Audio capture is now handled in the popup due to V3 restrictions

class AudioTranscribeServiceWorker {
    constructor() {
        console.log('Audio Transcribe Service Worker initializing...');
        this.initializeExtension();
    }

    initializeExtension() {
        // Listen for extension installation
        chrome.runtime.onInstalled.addListener((details) => {
            console.log('Audio Transcribe Extension installed:', details.reason);
        });

        // Handle any messages (for future use)
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            console.log('Service worker received message:', message);
            
            // For now, just acknowledge messages
            // Later we might handle API calls to backend here
            switch (message.action) {
                case 'PING':
                    sendResponse({ success: true, message: 'Service worker is alive' });
                    break;
                    
                default:
                    sendResponse({ success: false, error: 'Unknown action' });
            }
            
            return true;
        });

        console.log('Service worker initialized successfully');
    }
}

// Initialize the service worker
new AudioTranscribeServiceWorker();