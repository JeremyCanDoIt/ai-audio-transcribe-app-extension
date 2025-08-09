// chrome-extension/recorder/recorder-window.js
//Only way to circumvent manifest v3.
class AudioRecorderWindow {
    constructor() {
        // DOM elements
        this.stopButton = document.getElementById('stopButton');
        this.buttonIcon = document.getElementById('buttonIcon');
        this.status = document.getElementById('status');
        this.tabInfo = document.getElementById('tabInfo');
        this.duration = document.getElementById('duration');
        this.audioVisualizer = document.getElementById('audioVisualizer');
        this.minimizeBtn = document.getElementById('minimizeBtn');
        
        // Recording state
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioStream = null;
        this.audioChunks = [];
        this.startTime = null;
        this.durationInterval = null;
        this.currentTabId = null;
        this.currentTab = null;
        
        //Audio passthrough properties
        this.audioContext = null;
        this.audioSource = null;

        //initialize
        this.init();
    }

    /*
        Is called from constructor. Initializes event listeners.
    */
    async init() {
        console.log('Audio Recorder Window initializing...');
        
        try {
            // Get the tab that is supposed to record from URL params
            const urlParams = new URLSearchParams(window.location.search);
            this.currentTabId = parseInt(urlParams.get('tabId'));
            
            if (this.currentTabId) {
                await this.loadTabInfo();
            }
            
            this.setupEventListeners();
            this.startRecording();

            this.updateUI();
            
            console.log('Recorder window ready for tab:', this.currentTabId);
        } catch (error) {
            console.error('Error initializing recorder window:', error);
            this.updateStatus('Error: ' + error.message);
        }
    }

    /*

        setupEventListeners() called from init.

    */
    setupEventListeners() {
        // Record button
        this.stopButton.addEventListener('click', () => this.stopRecording());
        
        // Minimize button
        this.minimizeBtn.addEventListener('click', () => this.minimizeWindow());
        
        // Handle window close
        window.addEventListener('beforeunload', () => {
            if (this.isRecording) {
                this.stopRecording();
            }
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (event) => {
            if (event.code === 'Space' && !event.repeat) {
                event.preventDefault();
                this.stopRecording();
            }
        });
    }

    /*
        Checks if tab is actually loaded.
        Called from init().
    */
    async loadTabInfo() {
        try {
            if (this.currentTabId) {
                this.currentTab = await chrome.tabs.get(this.currentTabId);
                this.tabInfo.textContent = this.currentTab.title || 'Unknown Tab';
                this.stopButton.disabled = false;
                this.updateStatus('Ready to record');
            } else {
                this.tabInfo.textContent = 'No tab selected';
                this.updateStatus('No tab to record');
            }
        } catch (error) {
            console.error('Error loading tab info:', error);
            this.tabInfo.textContent = 'Error loading tab';
            this.updateStatus('Error: Cannot access tab');
        }
    }

    //No longer need this as we are toggling it on by default.
   /* async toggleRecording() {
        console.log('Toggle recording, current state:', this.isRecording);
        
        try {
            if (this.isRecording) {
                await this.stopRecording();
            } else {
                await this.startRecording();
            }
        } catch (error) {
            console.error('Error toggling recording:', error);
            this.updateStatus('Error: ' + error.message);
        }
    }
    */

    /*

    Called from init();
    */
    async startRecording() {
        console.log('Starting recording for tab:', this.currentTabId);

        //prevent user error when initializing
        this.stopButton.disabled = true;
        this.updateStatus('Starting...');
        
        try {
            // Capture audio from the tab using chrome.tabCapture
            this.audioStream = await this.captureTabAudio();

            if (!this.audioStream) {
                throw new Error('Failed to capture audio stream');
            }
            
            // Set up MediaRecorder
            this.setupMediaRecorder();
            
            // Record chunk every 10 seconds.
            this.mediaRecorder.start(10000); 
            
            // Update UI
            this.isRecording = true;
            this.startTime = Date.now();
            this.updateUI();
            this.startDurationCounter();
            
            console.log('Recording started successfully');
            
        } catch (error) {
            console.error('Failed to start recording:', error);
            this.cleanup();
            this.updateStatus('Error: ' + error.message);
            throw error;
        } finally {
            this.stopButton.disabled = false;
        }
    }

    /*
    Called when button is pressed.

    */
    async stopRecording() {
        console.log('Stopping recording...');
        
        this.stopButton.disabled = true;
        this.updateStatus('Stopping...');
        
        try {
            // Stop MediaRecorder
            if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                this.mediaRecorder.stop();
            }
            
            // Clean up
            this.cleanup();
            
            console.log('Recording stopped successfully');
            
        } catch (error) {
            console.error('Error stopping recording:', error);
            this.cleanup(); // Force cleanup
            throw error;
        } finally {
            this.stopButton.disabled = true;
        }
    }

    async captureTabAudio() {
        return new Promise((resolve, reject) => {
            console.log('Requesting tab capture for tab:', this.currentTabId);
            
            // This is the key part - chrome.tabCapture.capture must be called from a visible page
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
                    console.error('Tab capture error:', chrome.runtime.lastError);
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }

                if (!stream) {
                    reject(new Error('No audio stream captured - tab may not have audio'));
                    return;
                }

                console.log('Audio stream captured successfully');
                console.log('Stream tracks:', stream.getTracks().map(track => ({
                    kind: track.kind,
                    enabled: track.enabled,
                    muted: track.muted,
                    readyState: track.readyState
                })));
                
                resolve(stream);
            });
        });
    }

    /*
    Called from startRecording()
    Initializes audio capture from chrome.tab.record.

    */
    setupMediaRecorder() {
        try {
            // Create MediaRecorder with WebM format
            this.mediaRecorder = new MediaRecorder(this.audioStream, {
                mimeType: 'audio/webm;codecs=opus'
            });
            
            this.setupAudioPassthrough(this.audioStream);

            console.log('MediaRecorder created with MIME type:', this.mediaRecorder.mimeType);

            // Handle data available (audio chunks), every 10 seconds.
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    console.log('Audio chunk received, size:', event.data.size, 'bytes');
                    var audioChunk= event.data;
                    this.audioChunks.push(audioChunk);
                    
                    // TODO: Later we'll send chunk to backend for transcription
                    // For now, just log the progress
                    const totalSize = this.audioChunks.reduce((sum, chunk) => sum + chunk.size, 0);
                    console.log('Total audio captured:', totalSize, 'bytes');
                }
            };

            // Handle recording stop
            this.mediaRecorder.onstop = () => {
                console.log('MediaRecorder stopped, processing final audio...');
                
                if (this.audioChunks.length > 0) {
                    // Create final audio blob
                    const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                    console.log('Final audio blob created:', audioBlob.size, 'bytes');
                    
                    // download end audio - just for testing
                    const url = URL.createObjectURL(audioBlob);
                        const a = document.createElement('a');
                        a.style.display = 'none'; // Hide the anchor element
                        a.href = url;
                        a.download = 'audio.webm'; // Specify the desired filename for the download
                        document.body.appendChild(a); // Append to the DOM temporarily
                        a.click(); // Programmatically click the anchor to initiate download
                        document.body.removeChild(a); // Remove the anchor element after download is triggered
                        URL.revokeObjectURL(url); // Release the Blob URL to free up memory

                    this.updateStatus('Audio captured successfully');
                    
                    // Clear chunks for next recording
                    this.audioChunks = [];
                } else {
                    console.warn('No audio chunks collected');
                    this.updateStatus('No audio was captured');
                }
            };

            // Handle errors
            this.mediaRecorder.onerror = (event) => {
                console.error('MediaRecorder error:', event.error);
                this.updateStatus('Recording error: ' + event.error.message);
                this.cleanup();
            };

        } catch (error) {
            console.error('Error setting up MediaRecorder:', error);
            throw error;
        }
    }

    /*

    setupAudioPassthrough(stream) takes the audio stream and enables playback.
    Otherwise audio will be mute once recording starts.
    */
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
    /*
        If errors occur or stopButton is pressed.
    */
    cleanup() {
        console.log('Cleaning up recording resources...');
        
        // Stop duration counter
        if (this.durationInterval) {
            clearInterval(this.durationInterval);
            this.durationInterval = null;
        }

        //cleanup audio context
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        // Stop audio stream
        if (this.audioStream) {
            this.audioStream.getTracks().forEach(track => {
                track.stop();
                console.log('Stopped audio track:', track.kind);
            });
            this.audioStream = null;
        }
        
        // Reset state
        this.isRecording = false;
        this.mediaRecorder = null;
        this.startTime = null;
        this.audioChunks = [];
        // Update UI
        this.updateUI();
    }

    startDurationCounter() {
        this.durationInterval = setInterval(() => {
            if (this.startTime) {
                const elapsed = Date.now() - this.startTime;
                this.duration.textContent = this.formatDuration(elapsed);
            }
        }, 1000);
    }

    updateUI() {
        if (this.isRecording) {
            // Recording state
            this.stopButton.classList.add('recording');
            this.buttonIcon.textContent = '⏹️';
            this.audioVisualizer.classList.add('active');
            this.updateStatus('Recording...');
        } else {
            // Ready state
            this.stopButton.classList.remove('recording');
            this.buttonIcon.textContent = '🎙️';
            this.audioVisualizer.classList.remove('active');
            this.duration.textContent = '00:00';
            
            if (this.stopButton.disabled) {
                this.updateStatus('Loading...');
            } else {
                this.updateStatus('Ready to record');
            }
        }
    }

    updateStatus(message) {
        this.status.textContent = message;
        console.log('Status:', message);
    }

    minimizeWindow() {
        // Minimize the window (it will stay in the background while recording)
        chrome.windows.getCurrent((window) => {
            chrome.windows.update(window.id, { state: 'minimized' });
        });
    }

    formatDuration(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing recorder window...');
    new AudioRecorderWindow();
});