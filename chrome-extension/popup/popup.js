// chrome-extension/popup/popup.js

class AudioTranscribePopup {
    constructor() {
        //DOM elements
        //TODO: Add more features and a dashboard perhaps
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
        
        //State - keep it simple
        this.isRecording = false;
        this.currentTabId = null;
        this.audioRecordings = []; // Store completed audio recordings

        //Audio recording properties
        this.mediaRecorder = null;
        this.audioStream = null;
        this.audioChunks = [];
        this.chunkInterval = null;
        
        //Audio passthrough properties
        this.audioContext = null;
        this.audioSource = null;
        
        this.init();
    }

    async init() {
        console.log('Audio Transcribe Popup initializing...');
        
        //Load current tab info
        await this.loadCurrentTab();

        // Set up event listeners
        this.setupEventListeners();
        
        //Update UI
        this.updateUI();
        
        console.log('Audio Transcribe Popup ready!');
    }

    setupEventListeners() {
        // Record button - main functionality
        this.recordButton.addEventListener('click', () => this.toggleRecording());
        

        // Clear recordings button
        document.getElementById('clearButton').addEventListener('click', () => this.clearRecordings());

        // Error modal handlers
        document.getElementById('closeError').addEventListener('click', () => this.hideError());
        document.getElementById('okButton').addEventListener('click', () => this.hideError());
        
        // Handle page unload - cleanup if recording
        window.addEventListener('beforeunload', () => {
            if (this.isRecording) {
                this.cleanup();
            }
        });
    }

    async loadCurrentTab() {
        try {
            //Get the active tab
            const [activeTab] = await chrome.tabs.query({ 
                active: true, 
                currentWindow: true 
            });
            
            if (activeTab) {
                this.currentTabId = activeTab.id;
                this.tabTitle.textContent = activeTab.title || 'Unknown Tab';
                this.tabUrl.textContent = this.formatUrl(activeTab.url);
                
                //For now, assume all tabs can have audio,let chrome.tabCapture handle the validation
                this.recordButton.disabled = false;
                this.updateStatus('Ready', 'ready');
                this.usageInfo.textContent = 'Click Start Recording to capture audio';
                
                console.log('Current tab loaded:', activeTab.title);
            } else {
                this.tabTitle.textContent = 'No active tab';
                this.recordButton.disabled = true;
                this.updateStatus('No tab', 'ready');
            }
        } catch (error) {
            console.error('Error loading current tab:', error);
            this.showError('Failed to access current tab');
        }
    }

    async toggleRecording() {
        console.log('Toggle recording clicked, current state:', this.isRecording);
        
        try {
            if (this.isRecording) {
                await this.stopRecording();
            } else {
                await this.startRecording();
            }
        } catch (error) {
            console.error('Error toggling recording:', error);
            this.showError(error.message || 'Failed to toggle recording');
        }
    }

    async startRecording() {
        console.log('Starting recording for tab:', this.currentTabId);
        
        // Disable button during operation
        this.recordButton.disabled = true;
        this.updateStatus('Starting...', 'processing');
        
        try {
            //In Manifest V3, tabCapture must be called from popup, not service worker
            await this.captureTabAudio();
            
        } catch (error) {
            console.error('Start recording error:', error);
            this.showError(error.message);
            this.updateStatus('Ready', 'ready');
            this.recordButton.disabled = false;
        }
    }

    async captureTabAudio() {
        return new Promise((resolve, reject) => {
            console.log('Requesting tab capture from popup...');
            
            chrome.tabCapture.capture({
                audio: true,
                video: false,
                audioConstraints: { 
                    mandatory: { 
                        chromeMediaSource: 'tab' 
                    } 
                }
            }, (stream) => {
                if (chrome.runtime.lastError) {
                    console.error('Tab capture error:', chrome.runtime.lastError.message);
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }

                if (!stream) {
                    reject(new Error('No audio stream captured - tab may not have audio'));
                    return;
                }

                console.log('Audio stream captured successfully:', stream);
                
                // Now that we have the stream, set up recording
                this.setupMediaRecorder(stream);
                resolve(stream);
            });
        });
    }

    setupMediaRecorder(stream) {
        try {
            // Store the stream so we can stop it later
            this.audioStream = stream;
            this.audioChunks = [];

            //Ver IMPORTANT: Continue playing audio to user (chrome.tabCapture mutes by default)
            this.setupAudioPassthrough(stream);

            // Create MediaRecorder
            this.mediaRecorder = new MediaRecorder(stream, { 
                mimeType: 'audio/webm;codecs=opus'
            });

            console.log('MediaRecorder created with MIME type:', this.mediaRecorder.mimeType);

            // Handle data available (audio chunks)
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    console.log('Audio chunk received, size:', event.data.size);
                    this.audioChunks.push(event.data);
                }
            };

            // Handle recording stop
            this.mediaRecorder.onstop = () => {
                console.log('MediaRecorder stopped, total chunks:', this.audioChunks.length);
                
                if (this.audioChunks.length > 0) {
                    const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                    console.log('Final audio blob size:', audioBlob.size, 'bytes');
                    
                    // TODO: Send audioBlob to backend for transcription
                    // this.saveAudioRecording(audioBlob);
                    
                    //clear chunks for next recording
                    this.audioChunks=[];

                }
                
                // Clean up
                this.cleanup();
            };

            // Handle errors
            this.mediaRecorder.onerror = (event) => {
                console.error('MediaRecorder error:', event.error);
                this.showError('Recording error: ' + event.error.message);
                this.cleanup();
            };

            // Start recording
            this.mediaRecorder.start();
            
            // Update UI state
            this.isRecording = true;
            this.updateStatus('Recording...', 'recording');
            this.recordButton.classList.add('recording');
            this.buttonIcon.textContent = '⏹️';
            this.buttonText.textContent = 'Stop Recording';
            this.usageInfo.textContent = 'Audio is being captured from this tab';
            this.recordButton.disabled = false;
            
            console.log('Recording started successfully');

            // Set up chunking - create chunks every 10 seconds for testing
            this.chunkInterval = setInterval(() => {
                if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                    console.log('Processing new audio chunk...');
                  

                    //create new blob from current chunks
                    const chunkBlob = new Blob(this.audioChunks, {type:'audio/webm'});
                    console.log("New audio chunk:", chunkBlob);
                    //todo send this blob to backend.

                    //todo also clear this.audioChunks
                }
            }, 10000); // 10 second chunks
            
        } catch (error) {
            console.error('Error setting up MediaRecorder:', error);
            this.showError('Failed to set up audio recording: ' + error.message);
            this.cleanup();
        }
    }

    setupAudioPassthrough(stream) {
        try {
            // Create AudioContext to route captured audio back to speakers
            this.audioContext = new AudioContext();
            
            // Create source from the captured stream
            this.audioSource = this.audioContext.createMediaStreamSource(stream);
            
            // Connect directly to speakers (destination)
            this.audioSource.connect(this.audioContext.destination);
            
            console.log('Audio passthrough enabled - user can still hear tab audio');
            
        } catch (error) {
            console.warn('Could not set up audio passthrough:', error);
            // This is not critical - recording will still work
        }
    }

    async stopRecording() {
        console.log('Stopping recording...');
        
        this.recordButton.disabled = true;
        this.updateStatus('Stopping...', 'processing');
        
        try {
            // Stop the MediaRecorder
            if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                this.mediaRecorder.stop();
            }
            
            // The cleanup will happen in the onstop event handler
            console.log('Recording stopped successfully');
            
        } catch (error) {
            console.error('Stop recording error:', error);
            this.showError(error.message);
            // Force cleanup on error
            this.cleanup();
        }
    }

    /*
        Called from mediarecorder on stop, as well as encountering any errors.

    */
    cleanup() {
        console.log('Cleaning up recording resources...');
        
        // Clear the chunk interval
        if (this.chunkInterval) {
            clearInterval(this.chunkInterval);
            this.chunkInterval = null;
        }
        
        // Clean up audio passthrough
        if (this.audioSource) {
            this.audioSource.disconnect();
            this.audioSource = null;
        }
        
        if (this.audioContext) {
            this.audioContext.close().catch(err => {
                console.warn('Error closing AudioContext:', err);
            });
            this.audioContext = null;
        }
        
        // Stop all tracks in the audio stream
        if (this.audioStream) {
            this.audioStream.getTracks().forEach(track => {
                track.stop();
                console.log('Stopped audio track');
            });
            this.audioStream = null;
        }
        
        // Clear MediaRecorder
        this.mediaRecorder = null;
        this.audioChunks = [];
        
        // Update UI state
        this.isRecording = false;
        this.updateStatus('Ready', 'ready');
        this.recordButton.classList.remove('recording');
        this.buttonIcon.textContent = '🎙️';
        this.buttonText.textContent = 'Start Recording';
        this.usageInfo.textContent = 'Recording stopped';
        this.recordButton.disabled = false;
        
        console.log('Cleanup complete');
    }

    updateStatus(text, type) {
        this.statusText.textContent = text;
        this.statusIndicator.parentElement.className = `status ${type}`;
        console.log('Status updated:', text, type);
    }

    updateUI() {
        // Update button state based on recording status
        if (this.isRecording) {
            this.recordButton.classList.add('recording');
            this.buttonIcon.textContent = '⏹️';
            this.buttonText.textContent = 'Stop Recording';
            this.updateStatus('Recording...', 'recording');
        } else {
            this.recordButton.classList.remove('recording');
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