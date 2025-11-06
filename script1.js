// --- SCRIPT 1: CORE, STATE, AND INITIALIZATION (WITH AI & EQ STATE) ---

// Global state for the entire application
const state = {
    library: [],
    playlists: {},
    recents: [],
    ytHistory: [],
    userName: 'Aura User',
    userProfilePic: '',
    currentView: 'home',
    currentTracklistSource: { type: 'library', name: 'Library' },
    queue: [],
    originalQueue: [],
    currentIndex: -1,
    isPlaying: false,
    isShuffle: false,
    repeatMode: 'none',
    lastVolume: 1,
    currentTrackMetadata: { title: null, artist: null, picture: null },
    appStartTime: Date.now(),
    // Timer ID for cleanup (Issue 13)
    sessionTimerId: null, 
    settings: {
        titleGlow: true,
        dynamicIsland: true,
        showMessages: true,
        visualEffects: true,
        musicVisualizer: true,
        aiDjEnabled: false,
        aiFeaturesEnabled: false, // Main toggle for all AI functionality
        activeTheme: 'aura-default',
        activeEqPreset: 'flat', // Default equalizer preset
        customEqValues: { low: 0, mid: 0, high: 0 }, // User's custom settings
        // New Theme Customization Settings
        animationSpeed: 1, // 0.5 (fast) to 1.5 (slow)
        colorIntensity: 100, // 50 to 150
        customBackground: '', // data:url string
        backgroundBlur: 5, // 0 to 20
    },
    // Google API state: 'ready' (API loaded), 'signedIn' (User signed in), 'failed' (API init failed)
    googleApiReady: false, 
    googleDriveSignedIn: false,
    googleAuthToken: null,
    googleUserName: '',
    googleUserEmail: '',
    googleUserPicture: '',
    audioContext: null,
    sourceNode: null,
    analyser: null,
    eqFilters: { // New equalizer filter nodes
        low: null,
        mid: null,
        high: null,
    },
    animationFrameId: null,
    ytPlayer: null,
    currentYtInfo: { id: null, title: null, author: null },
    // API Keys
    geminiApiKeys: [
        'AIzaSyAlCP8-iNqKX0llOLqRRTv8EVdZWDUBkAU',
        'AIzaSyAThiqodRdUJCmqfJc-6ddrglcpPBU7hT0',
        'AIzaSyBbX9uyGppPyCEkmETevyMFig1BOmMZrlA',
        'AIzaSyD2SJZXFEdGmUihQC_NZoUiT5-RG5NWABQ',
        'AIzaSyC6u5oqqPx7tzpGNgXhxIv1XovWXuwnjcY'
    ],
    jamendoClientId: 'f8772234', // <<< HEY! ADD YOUR JAMENDO CLIENT ID HERE
    currentApiKeyIndex: 0,
    chatHistory: [],
    isAiPlaylistMode: false, // To differentiate modal purpose
};

// --- Equalizer Presets Definition ---
const EQ_PRESETS = {
    flat: { name: 'Flat', icon: 'fa-minus', values: { low: 0, mid: 0, high: 0 } },
    bassBoost: { name: 'Bass Boost', icon: 'fa-drum', values: { low: 6, mid: -2, high: -2 } },
    vocalBoost: { name: 'Vocal Boost', icon: 'fa-microphone-lines', values: { low: -2, mid: 5, high: 0 } },
    trebleBoost: { name: 'Treble Boost', icon: 'fa-guitar', values: { low: -2, mid: -2, high: 6 } },
    custom: { name: 'Custom', icon: 'fa-sliders', values: {} } // Placeholder for custom settings
};

// --- Main DOM element references ---
// These are elements that are always present in the HTML.
const dom = {
    loadingOverlay: document.getElementById('loading-overlay'),
    toastContainer: document.getElementById('toast-container'),
    auraScreenContainer: document.querySelector('.aura-screen-container'),
    viewContent: document.getElementById('view-content'),
    navItems: document.querySelectorAll('.sidebar .nav-item'),
    appTime: document.getElementById('app-time'),
    appTitle: document.getElementById('app-title'),
    audioPlayer: document.getElementById('audio-player'),
    recentsList: document.getElementById('recents-list'),
    playlistsList: document.getElementById('playlists-list'),
    topBar: document.querySelector('.top-bar'),
    topBarDefault: document.getElementById('top-bar-default'),
    topBarNowPlaying: document.getElementById('top-bar-now-playing'),
    nowPlayingArtwork: document.getElementById('now-playing-artwork'),
    nowPlayingTitle: document.getElementById('now-playing-title'),
    nowPlayingArtist: document.getElementById('now-playing-artist'),
    nowPlayingPlayPauseBtn: document.getElementById('now-playing-play-pause-btn'),
    aiReadyToggle: document.getElementById('ai-ready-toggle'),
    customBg: document.getElementById('custom-bg'),
};

// --- Dynamic DOM element references ---
// This object is populated with references to elements that are created/destroyed when views change.
let dynamicDom = {};

// --- INITIALIZATION ---
// This is the entry point of the application when the HTML is fully loaded.
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    attachGlobalEventListeners();
    loadInitialData();
});

// --- Timer Cleanup (Issue 13) ---
window.addEventListener('beforeunload', () => {
    if (state.sessionTimerId) {
        clearInterval(state.sessionTimerId);
        state.sessionTimerId = null;
        console.log("Session timer cleared.");
    }
    // Also ensures any current blob URL is revoked
    if (typeof lastBlobUrl !== 'undefined' && lastBlobUrl) {
         URL.revokeObjectURL(lastBlobUrl);
    }
});
// --- End Timer Cleanup ---


// --- Loads initial data and sets up the UI ---
function loadInitialData() {
    applyPerformanceMode();
    applyTheme(state.settings.activeTheme);
    applyThemeCustomizations(); // Apply saved customizations
    renderCurrentView();
    renderRecents();
    renderPlaylists();
    dom.appTitle.classList.toggle('title-glow', state.settings.titleGlow);
    updateAiReadyToggleUI(); // Set initial state of the AI toggle
    
    // CRITICAL: Hide loading screen early. If GAPI fails, backend.js will handle the update.
    if (dom.loadingOverlay) {
        dom.loadingOverlay.classList.add('hidden');
    }

    // Starts the session timer (Issue 13)
    state.sessionTimerId = setInterval(() => {
        const elapsed = Math.floor((Date.now() - state.appStartTime) / 1000);
        const m = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const s = (elapsed % 60).toString().padStart(2, '0');
        if(dom.appTime) dom.appTime.textContent = `${m}:${s}`;
    }, 1000);
}

// --- Attaches event listeners to elements that persist across all views ---
function attachGlobalEventListeners() {
    // Navigation item clicks
    dom.navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const newView = item.dataset.view;

            // If the user clicks 'home', always reset the tracklist source to the main library.
            if (newView === 'home') {
                state.currentTracklistSource = { type: 'library', name: 'Library' };
            }

            // If the view is different, or if it's the home view (to allow resetting), change the view.
            if (newView !== state.currentView || newView === 'home') {
                state.currentView = newView;
                renderCurrentView();
            }
        });
    });

    // AI Features Toggle
    if (dom.aiReadyToggle) {
        dom.aiReadyToggle.addEventListener('click', () => {
            state.settings.aiFeaturesEnabled = !state.settings.aiFeaturesEnabled;
            const isEnabled = state.settings.aiFeaturesEnabled;
            showToast(`AI Features ${isEnabled ? 'Enabled!' : 'Disabled.'}`, isEnabled ? 'success' : 'info');
            updateAiReadyToggleUI();
            saveState();
        });
    }

    // Audio Player Events
    dom.audioPlayer.addEventListener('play', () => {
        state.isPlaying = true;
        if (typeof updatePlayPauseIcon === 'function') updatePlayPauseIcon();
        if (typeof updatePlayingTrackUI === 'function') updatePlayingTrackUI();
        if (state.currentView === 'player' && state.settings.musicVisualizer && !state.animationFrameId) {
            if (typeof drawVisualizer === 'function') drawVisualizer();
        }
    });
    dom.audioPlayer.addEventListener('pause', () => {
        state.isPlaying = false;
        if (typeof updatePlayPauseIcon === 'function') updatePlayPauseIcon();
        if (typeof updatePlayingTrackUI === 'function') updatePlayingTrackUI();
        if(state.animationFrameId) {
            cancelAnimationFrame(state.animationFrameId);
            state.animationFrameId = null;
        }
    });
    dom.audioPlayer.addEventListener('ended', () => {
        if (typeof playNext === 'function') playNext();
    });
    dom.audioPlayer.addEventListener('timeupdate', () => {
        if (!dynamicDom.progressBar || isNaN(dom.audioPlayer.currentTime)) return;
        dynamicDom.progressBar.value = dom.audioPlayer.currentTime;
        if(dynamicDom.currentTime) dynamicDom.currentTime.textContent = formatTime(dom.audioPlayer.currentTime);
    });
    dom.audioPlayer.addEventListener('loadedmetadata', () => {
        if (!dynamicDom.progressBar || isNaN(dom.audioPlayer.duration)) return;
        dynamicDom.progressBar.max = dom.audioPlayer.duration;
        if(dynamicDom.totalDuration) dynamicDom.totalDuration.textContent = formatTime(dom.audioPlayer.duration);
    });

    // Top Bar Now Playing Controls
    if (dom.nowPlayingPlayPauseBtn) {
        dom.nowPlayingPlayPauseBtn.addEventListener('click', () => {
            if(dom.audioPlayer.src) {
                dom.audioPlayer.paused ? dom.audioPlayer.play() : dom.audioPlayer.pause();
            }
        });
    }

    const nowPlayingInfo = document.getElementById('now-playing-info');
    if (nowPlayingInfo) {
        nowPlayingInfo.addEventListener('click', () => {
            if (state.currentView !== 'player' && (state.currentIndex > -1 || dom.audioPlayer.src)) {
                state.currentView = 'player';
                renderCurrentView();
            }
        });
    }

    // Drag and Drop file handling
    const container = dom.auraScreenContainer;
    container.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); container.classList.add('dragover'); });
    container.addEventListener('dragleave', (e) => { e.preventDefault(); e.stopPropagation(); container.classList.remove('dragover'); });
    container.addEventListener('drop', (e) => {
        e.preventDefault(); e.stopPropagation(); container.classList.remove('dragover');
        if (state.currentView !== 'home') {
            state.currentView = 'home';
            renderCurrentView().then(() => handleFiles(e.dataTransfer.files));
        } else {
            handleFiles(e.dataTransfer.files);
        }
    });
}

// --- DATA HANDLING & PERSISTENCE ---

// --- Handles dropped or selected local audio files ---
function handleFiles(files) {
    const newFiles = Array.from(files).filter(f => f.type.startsWith('audio/') && !state.library.some(t => t.name === f.name));
    if (newFiles.length > 0) {
        state.library.push(...newFiles.map(f => ({ 
            name: f.name, 
            file: f, 
            source: 'local',
            artist: 'Local File',
            id: `local-${f.name}-${f.lastModified}` 
        })));
        state.currentTracklistSource = { type: 'library', name: 'Library' };
        if (typeof renderTrackList === 'function') renderTrackList(); 
        saveState();
        if (typeof showToast === 'function') showToast(`${newFiles.length} new song(s) added!`, 'success');
    }
}


// --- Saves the essential parts of the state to localStorage ---
function saveState() {
    try {
        const stateToSave = {
            playlists: state.playlists,
            recents: state.recents,
            ytHistory: state.ytHistory,
            settings: state.settings,
            lastVolume: state.lastVolume,
            userName: state.userName,
            userProfilePic: state.userProfilePic,
            googleAuthToken: state.googleAuthToken,
        };
        localStorage.setItem('auraPlayerData', JSON.stringify(stateToSave));

        if (state.googleDriveSignedIn) {
            if (typeof saveStateToDrive === 'function') {
                saveStateToDrive();
            }
        }
    } catch (error) {
        console.error("Failed to save state:", error);
        if (typeof showToast === 'function') showToast("Could not save settings.", "error");
    }
}

// --- Loads state from localStorage on application start ---
function loadState() {
    const savedData = localStorage.getItem('auraPlayerData');
    if (savedData) {
        try {
            const parsedData = JSON.parse(savedData);
            state.settings = { ...state.settings, ...parsedData.settings };
            state.lastVolume = parsedData.lastVolume || 1;
            state.userName = parsedData.userName || 'Aura User';
            state.userProfilePic = parsedData.userProfilePic || '';
            state.googleAuthToken = parsedData.googleAuthToken || null;
            dom.audioPlayer.volume = state.lastVolume;
            
            state.playlists = parsedData.playlists || {};
            state.recents = parsedData.recents || [];
            state.ytHistory = parsedData.ytHistory || [];
        } catch (error) {
            console.error("Failed to load state from localStorage:", error);
            localStorage.removeItem('auraPlayerData'); // Clear corrupted data
        }
    }
    // Ensure the "Liked Songs" playlist always exists
    if (!state.playlists['Liked Songs']) {
        state.playlists['Liked Songs'] = { name: 'Liked Songs', tracks: [] };
    }
}

// --- Adds a track to the top of the recently played list ---
function addToRecents(trackName) {
    state.recents = state.recents.filter(t => t !== trackName);
    state.recents.unshift(trackName);
    if (state.recents.length > 20) state.recents.pop();
    saveState();
    if (typeof renderRecents === 'function') renderRecents();
}

// --- UI HELPER FUNCTIONS ---

// --- Toggles performance-related CSS classes based on settings ---
function applyPerformanceMode() {
    document.body.classList.toggle('performance-mode', !state.settings.visualEffects);
}

// --- Updates the "AI Ready" toggle button's appearance ---
function updateAiReadyToggleUI() {
    if (!dom.aiReadyToggle) return;
    const isEnabled = state.settings.aiFeaturesEnabled;
    dom.aiReadyToggle.textContent = isEnabled ? 'AI Ready ✅' : 'AI Ready ❌';
    dom.aiReadyToggle.classList.toggle('ai-ready-glow', isEnabled);
}

// --- Applies theme customizations like colors and background images ---
function applyThemeCustomizations() {
    if (!dom.customBg) {
        console.error("Custom background element not found in DOM.");
        return;
    }
    const root = document.documentElement;
    root.style.setProperty('--animation-speed-multiplier', state.settings.animationSpeed);
    root.style.setProperty('--color-intensity', `${state.settings.colorIntensity}%`);
    
    if (state.settings.customBackground) {
        dom.customBg.style.backgroundImage = `url(${state.settings.customBackground})`;
        dom.customBg.style.filter = `blur(${state.settings.backgroundBlur}px)`;
        dom.customBg.style.opacity = 1;
    } else {
        dom.customBg.style.opacity = 0;
    }
}
