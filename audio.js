// DOCMATE - Audio Management
// Handles TTS, audio playback, and timeline controls

let currentUtterance = null;
let isSpeaking = false;
let audioProgress = 0;
let audioTimeline = null;
let speechStartTime = 0;
let estimatedDuration = 0;
 
// Initialize audio controls
function initializeAudioControls() {
    audioTimeline = document.getElementById('audioTimeline');
    updateAudioDisplay();
}

// Toggle audio panel visibility
function toggleAudioPanel() {
    const timeline = document.getElementById('audioTimeline');
    if (timeline) {
        if (timeline.style.display === 'none' || timeline.style.display === '') {
            timeline.style.display = 'block';
            showToast('Audio controls activated', 'info');
        } else {
            timeline.style.display = 'none';
        }
    }
}

// Toggle playback (play/pause)
function togglePlayback() {
    if (isSpeaking) {
        pauseReading();
    } else {
        startReading();
    }
}

// Start reading current page
function startReading() {
    if (!currentBook || !currentBook.pages || currentBook.pages.length === 0) {
        showToast('No content to read', 'warning');
        return;
    }

    const pageContent = currentBook.pages[currentPage];
    if (!pageContent || !pageContent.trim()) {
        showToast('No text content on this page', 'warning');
        return;
    }

    // Stop any current speech
    if (isSpeaking) {
        stopReading();
    }

    // Clean text for better speech
    const cleanText = pageContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    
    if ('speechSynthesis' in window) {
        currentUtterance = new SpeechSynthesisUtterance(cleanText);
        
        // Configure voice based on selections
        const selectedLang = document.getElementById('languageSelector').value;
        const voiceType = document.getElementById('voiceSelector').value;
        const langConfig = languageConfig[selectedLang];
        
        // Set language
        currentUtterance.lang = langConfig.lang;
        
        // Configure voice characteristics
        configureVoice(currentUtterance, voiceType);
        
        // Try to find a voice that matches the language
        const voices = speechSynthesis.getVoices();
        const preferredVoice = findPreferredVoice(voices, selectedLang, langConfig, voiceType);
        
        if (preferredVoice) {
            currentUtterance.voice = preferredVoice;
        }

        // Estimate duration (rough calculation: ~150 words per minute)
        const wordCount = cleanText.split(/\s+/).length;
        estimatedDuration = (wordCount / 150) * 60; // seconds

        // Event handlers
        currentUtterance.onstart = function() {
            isSpeaking = true;
            speechStartTime = Date.now();
            updatePlayButton();
            updateAudioStatus('Playing...');
            startProgressTracking();
            showToast(`Reading aloud in ${langConfig.name}...`, 'info');
        };

        currentUtterance.onend = function() {
            isSpeaking = false;
            audioProgress = 0;
            updatePlayButton();
            updateAudioStatus('Ready to play');
            updateTimelineProgress();
            
            // Auto-advance to next page
            setTimeout(() => {
                if (canGoToNextPage()) {
                    nextPage();
                    setTimeout(() => startReading(), 1000);
                }
            }, 500);
        };

        currentUtterance.onerror = function(event) {
            console.error('Speech synthesis error:', event.error);
            isSpeaking = false;
            updatePlayButton();
            updateAudioStatus('Error occurred');
            showToast('Error reading text aloud', 'error');
        };

        currentUtterance.onpause = function() {
            updateAudioStatus('Paused');
        };

        currentUtterance.onresume = function() {
            updateAudioStatus('Playing...');
        };

        // Start speech
        speechSynthesis.speak(currentUtterance);
    } else {
        showToast('Text-to-speech not supported in your browser', 'error');
    }
}

// Pause reading
function pauseReading() {
    if (speechSynthesis.speaking && !speechSynthesis.paused) {
        speechSynthesis.pause();
        updatePlayButton();
        updateAudioStatus('Paused');
        showToast('Reading paused', 'info');
    }
}

// Resume reading
function resumeReading() {
    if (speechSynthesis.paused) {
        speechSynthesis.resume();
        updatePlayButton();
        updateAudioStatus('Playing...');
        showToast('Reading resumed', 'info');
    }
}

// Stop reading
function stopReading() {
    speechSynthesis.cancel();
    isSpeaking = false;
    audioProgress = 0;
    currentUtterance = null;
    updatePlayButton();
    updateAudioStatus('Ready to play');
    updateTimelineProgress();
    showToast('Reading stopped', 'info');
}

// Configure voice characteristics
function configureVoice(utterance, voiceType) {
    switch(voiceType) {
        case 'male':
            utterance.pitch = 0.8;
            utterance.rate = 0.9;
            utterance.volume = 1.0;
            break;
        case 'female':
            utterance.pitch = 1.2;
            utterance.rate = 0.95;
            utterance.volume = 1.0;
            break;
        default:
            utterance.pitch = 1.0;
            utterance.rate = 1.0;
            utterance.volume = 1.0;
    }
}

// Find preferred voice
function findPreferredVoice(voices, selectedLang, langConfig, voiceType) {
    // First, try to find a voice that matches the language and gender
    let preferredVoice = voices.find(voice => {
        const matchesLang = voice.lang.startsWith(selectedLang) || 
                           voice.lang.toLowerCase().includes(selectedLang) ||
                           voice.lang === langConfig.lang;
        
        if (matchesLang) {
            const voiceName = voice.name.toLowerCase();
            if (voiceType === 'male' && (voiceName.includes('male') || voiceName.includes('man'))) {
                return true;
            }
            if (voiceType === 'female' && (voiceName.includes('female') || voiceName.includes('woman'))) {
                return true;
            }
            // If no gender-specific voice found, return any matching language
            return true;
        }
        return false;
    });
    
    // Fallback to any voice in the language
    if (!preferredVoice) {
        preferredVoice = voices.find(voice => 
            voice.lang.startsWith(selectedLang) || 
            voice.lang === langConfig.lang
        );
    }
    
    // Final fallback
    if (!preferredVoice && langConfig.fallback) {
        preferredVoice = voices.find(voice => voice.lang === langConfig.fallback);
    }
    
    return preferredVoice;
}

// Update play button state
function updatePlayButton() {
    const playBtn = document.getElementById('timelinePlayBtn');
    if (!playBtn) return;
    
    if (isSpeaking && !speechSynthesis.paused) {
        playBtn.innerHTML = '<i class="fas fa-pause"></i>';
        playBtn.title = 'Pause';
    } else {
        playBtn.innerHTML = '<i class="fas fa-play"></i>';
        playBtn.title = 'Play';
    }
}

// Update audio status text
function updateAudioStatus(status) {
    const statusElement = document.getElementById('audioStatus');
    if (statusElement) {
        statusElement.textContent = status;
    }
}

// Start progress tracking
function startProgressTracking() {
    const trackProgress = () => {
        if (isSpeaking && speechStartTime > 0) {
            const elapsed = (Date.now() - speechStartTime) / 1000;
            audioProgress = Math.min(elapsed / estimatedDuration, 1);
            updateTimelineProgress();
            updateTimeDisplay();
            
            if (isSpeaking) {
                requestAnimationFrame(trackProgress);
            }
        }
    };
    
    requestAnimationFrame(trackProgress);
}

// Update timeline progress
function updateTimelineProgress() {
    const progressBar = document.getElementById('timelineProgress');
    const handle = document.getElementById('timelineHandle');
    
    if (progressBar && handle) {
        const percentage = audioProgress * 100;
        progressBar.style.width = `${percentage}%`;
        handle.style.left = `${percentage}%`;
    }
}

// Update time display
function updateTimeDisplay() {
    const timeDisplay = document.getElementById('timelineTime');
    if (!timeDisplay) return;
    
    const elapsed = audioProgress * estimatedDuration;
    const remaining = estimatedDuration - elapsed;
    
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };
    
    timeDisplay.textContent = `${formatTime(elapsed)} / ${formatTime(estimatedDuration)}`;
}

// Seek audio to specific position
function seekAudio(event) {
    if (!currentUtterance || !estimatedDuration) {
        showToast('No audio playing to seek', 'warning');
        return;
    }
    
    const timeline = event.currentTarget;
    const rect = timeline.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = clickX / rect.width;
    
    // Stop current speech and restart from new position
    const wasPlaying = isSpeaking;
    stopReading();
    
    // Calculate new position in text
    if (currentBook && currentBook.pages && currentBook.pages[currentPage]) {
        const pageContent = currentBook.pages[currentPage];
        const words = pageContent.split(/\s+/);
        const newStartIndex = Math.floor(words.length * percentage);
        const newText = words.slice(newStartIndex).join(' ');
        
        if (newText.trim() && wasPlaying) {
            // Create new utterance from the seek position
            setTimeout(() => {
                const cleanText = newText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                if (cleanText) {
                    currentUtterance = new SpeechSynthesisUtterance(cleanText);
                    configureVoice(currentUtterance, document.getElementById('voiceSelector').value);
                    
                    // Adjust progress tracking
                    audioProgress = percentage;
                    speechStartTime = Date.now() - (percentage * estimatedDuration * 1000);
                    
                    currentUtterance.onstart = function() {
                        isSpeaking = true;
                        updatePlayButton();
                        updateAudioStatus('Playing...');
                        startProgressTracking();
                    };
                    
                    currentUtterance.onend = function() {
                        isSpeaking = false;
                        audioProgress = 0;
                        updatePlayButton();
                        updateAudioStatus('Ready to play');
                        updateTimelineProgress();
                    };
                    
                    speechSynthesis.speak(currentUtterance);
                }
            }, 100);
        }
    }
    
    // Update visual progress immediately
    audioProgress = percentage;
    updateTimelineProgress();
    updateTimeDisplay();
    
    showToast(`Seeked to ${Math.round(percentage * 100)}%`, 'info');
}

// Update audio progress when page changes
function updateAudioProgress() {
    if (isSpeaking) {
        stopReading();
    }
    audioProgress = 0;
    updateTimelineProgress();
    updateTimeDisplay();
    updateAudioStatus('Ready to play');
}

// Check if can go to next page
function canGoToNextPage() {
    return currentBook && 
           currentBook.pages && 
           currentPage < currentBook.pages.length - 1;
}

// Update audio display when book changes
function updateAudioDisplay() {
    if (currentBook) {
        updateAudioStatus('Ready to play');
        audioProgress = 0;
        updateTimelineProgress();
        updateTimeDisplay();
    } else {
        updateAudioStatus('No document loaded');
    }
}

// Voice synthesis utilities
function getAvailableVoices() {
    if ('speechSynthesis' in window) {
        return speechSynthesis.getVoices();
    }
    return [];
}

function getVoicesForLanguage(languageCode) {
    const voices = getAvailableVoices();
    return voices.filter(voice => 
        voice.lang.startsWith(languageCode) || 
        voice.lang.toLowerCase().includes(languageCode)
    );
}

// Initialize audio when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeAudioControls();
    
    // Load voices when available
    if ('speechSynthesis' in window) {
        speechSynthesis.onvoiceschanged = function() {
            console.log('Speech synthesis voices loaded:', getAvailableVoices().length);
        };
    }
});

// Export functions for use in main script
window.audioManager = {
    startReading,
    stopReading,
    pauseReading,
    resumeReading,
    togglePlayback,
    toggleAudioPanel,
    seekAudio,
    updateAudioProgress,
    updateAudioDisplay,
    getAvailableVoices,
    getVoicesForLanguage
};

