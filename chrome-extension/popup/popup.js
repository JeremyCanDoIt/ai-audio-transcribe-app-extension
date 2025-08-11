// chrome-extension/popup/popup.js

class AudioTranscribePopup {
    constructor() {
        // DOM elements - just the basics for now
        this.recordButton = document.getElementById('recordButton');
        this.buttonIcon = document.getElementById('buttonIcon');
        this.buttonText = document.getElementById('buttonText');
        this.statusIndicator = document.getElementById('statusIndicator');
        this.statusText = document.getElementById('statusText');
        this.tabTitle = document.getElementById('tabTitle');
        this.tabUrl = document.getElementById('tabUrl');
        this.usageInfo = document.getElementById('usageInfo');
        this.errorModal = document.getElementById('errorModal');
        this.errorMessage = document.getElementById('errorMessage');
        
        // State
        this.currentTabId = null;
        this.recorderWindowId = null;
        
        this.init();
    }

    async init() {
        console.log('Audio Transcribe Popup initializing...');
        
        // Load current tab info
        await this.loadCurrentTab();
        
        // Check if recorder window is already open
        await this.checkRecorderWindow();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Update UI
        this.updateUI();
        
        console.log('Audio Transcribe Popup ready!');
    }

    setupEventListeners() {
        // Record button - opens recorder window
        this.recordButton.addEventListener('click', () => this.openRecorderWindow());
        
        // Error modal handlers
        document.getElementById('closeError').addEventListener('click', () => this.hideError());
        document.getElementById('okButton').addEventListener('click', () => this.hideError());
    }

    async loadCurrentTab() {
        try {
            // Get the active tab
            const [activeTab] = await chrome.tabs.query({ 
                active: true, 
                currentWindow: true 
            });
            
            if (activeTab) {
                this.currentTabId = activeTab.id;
                this.tabTitle.textContent = activeTab.title || 'Unknown Tab';
                this.tabUrl.textContent = this.formatUrl(activeTab.url);
                
                // Enable the button - we'll let the recorder window handle audio validation
                this.recordButton.disabled = false;
                this.updateStatus('Ready', 'ready');
                this.usageInfo.textContent = 'Click to open audio recorder';
                
                console.log('Current tab loaded:', activeTab.title);
            } else {
                this.tabTitle.textContent = 'No active tab';
                this.recordButton.disabled = true;
                this.updateStatus('No tab', 'ready');
                this.usageInfo.textContent = 'No active tab found';
            }
        } catch (error) {
            console.error('Error loading current tab:', error);
            this.showError('Failed to access current tab');
        }
    }

    async checkRecorderWindow() {
        try {
            // Check if we have a recorder window open
            const windows = await chrome.windows.getAll();
            const recorderWindow = windows.find(window => 
                window.type === 'popup' && 
                window.tabs?.some(tab => tab.url?.includes('recorder-window.html'))
            );
            
            if (recorderWindow) {
                this.recorderWindowId = recorderWindow.id;
                this.updateStatus('Recording', 'recording');
                this.buttonText.textContent = 'Show Recorder';
                this.usageInfo.textContent = 'Recorder window is open';
                console.log('Found existing recorder window:', recorderWindow.id);
            }
        } catch (error) {
            console.warn('Error checking for recorder window:', error);
        }
    }

    async openRecorderWindow() {
        console.log('Opening recorder window for tab:', this.currentTabId);
        
        try {
            if (this.recorderWindowId) {
                // If recorder window already exists, focus it
                await chrome.windows.update(this.recorderWindowId, { focused: true });
                console.log('Focused existing recorder window');
                return;
            }
            
            if (!this.currentTabId) {
                throw new Error('No active tab selected');
            }
            
            // Create the recorder window
            const window = await chrome.windows.create({
                url: `recorder/recorder-window.html?tabId=${this.currentTabId}`,
                type: 'popup',
                width: 300,
                height: 410,
                top: 100,
                left: 100,
                focused: false
            });
            
            this.recorderWindowId = window.id;
            
            // Update UI to show recorder is open
            this.updateStatus('Recording', 'recording');
            this.buttonText.textContent = 'Show Recorder';
            this.usageInfo.textContent = 'Recorder window opened';
            
            console.log('Recorder window created:', window.id);
            
            // Listen for window close
            chrome.windows.onRemoved.addListener((windowId) => {
                if (windowId === this.recorderWindowId) {
                    console.log('Recorder window closed');
                    this.recorderWindowId = null;
                    this.updateStatus('Ready', 'ready');
                    this.buttonText.textContent = 'Start Recording';
                    this.usageInfo.textContent = 'Click to open audio recorder';
                }
            });
            
        } catch (error) {
            console.error('Error opening recorder window:', error);
            this.showError('Failed to open recorder: ' + error.message);
        }
    }

    updateStatus(text, type) {
        this.statusText.textContent = text;
        this.statusIndicator.parentElement.className = `status ${type}`;
        console.log('Status updated:', text, type);
    }

    updateUI() {
        // Update button based on whether recorder window is open
        if (this.recorderWindowId) {
            this.buttonIcon.textContent = '🔍';
            this.buttonText.textContent = 'Show Recorder';
            this.updateStatus('Recording', 'recording');
        } else {
            this.buttonIcon.textContent = '🎙️';
            this.buttonText.textContent = 'Start Recording';
            this.updateStatus('Ready', 'ready');
        }
    }

    showError(message) {
        console.error('Showing error:', message);
        this.errorMessage.textContent = message;
        this.errorModal.style.display = 'flex';
    }

    hideError() {
        this.errorModal.style.display = 'none';
    }

    // Utility function
    formatUrl(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname;
        } catch {
            return url || 'Unknown URL';
        }
    }
}

// Initialize the popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing popup...');
    new AudioTranscribePopup();
});       