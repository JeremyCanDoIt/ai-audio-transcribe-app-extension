// chrome-extension/background/service-worker.js

class AudioTranscribeService {
    constructor() {
        this.initializeExtension();
    }

    initializeExtension() {
        console.log('Audio Transcribe Extension service worker starting...');
        
        // Listen for extension installation
        chrome.runtime.onInstalled.addListener((details) => {
            console.log('Extension installed:', details.reason);
            
            // Set up default settings
            if (details.reason === 'install') {
                this.setDefaultSettings();
            }
        });

        // Handle messages (mostly for future backend communication)
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // Keep the message channel open for async responses
        });

        console.log('Service worker initialized');
    }

    async setDefaultSettings() {
        const defaultSettings = {
            chunkDuration: 15000, // 15 seconds
            apiUrl: 'https://localhost:7001',
            version: '1.0.0'
        };

        try {
            await chrome.storage.local.set(defaultSettings);
            console.log('Default settings saved');
        } catch (error) {
            console.error('Error saving default settings:', error);
        }
    }

    async handleMessage(message, sender, sendResponse) {
        console.log('Service worker received message:', message);
        
        try {
            switch (message.action) {
                case 'GET_SETTINGS':
                    const settings = await chrome.storage.local.get();
                    sendResponse({ success: true, settings });
                    break;

                case 'UPDATE_SETTINGS':
                    await chrome.storage.local.set(message.settings);
                    sendResponse({ success: true });
                    break;

                case 'SEND_AUDIO_TO_BACKEND':
                    // TODO: This will handle sending audio to backend API
                    // For now, just acknowledge
                    console.log('TODO: Send audio to backend', message.audioData?.size || 'no audio');
                    sendResponse({ success: true, message: 'Backend integration not implemented yet' });
                    break;

                default:
                    console.log('Unknown action:', message.action);
                    sendResponse({ error: 'Unknown action: ' + message.action });
            }
        } catch (error) {
            console.error('Error handling message:', error);
            sendResponse({ error: error.message });
        }
    }
}

// Initialize the service worker
const audioTranscribeService = new AudioTranscribeService();