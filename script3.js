// --- SCRIPT 3: PLAYER ENGINE, AUDIO API, AND CONTROLS (WITH AI & EQ) ---

function closeEqualizer() {
    const eqPanel = document.getElementById('eq-panel');
    if (eqPanel && eqPanel.classList.contains('active')) {
        eqPanel.classList.remove('active');
        if (dynamicDom.eqBtn) {
            dynamicDom.eqBtn.classList.remove('active');
        }
    }
}

function initMusicPlayerView() {
    // Dynamic DOM references - adding defensive checks for null
    dynamicDom.playPauseBtn = document.getElementById('play-pause-btn');
    dynamicDom.prevBtn = document.getElementById('prev-btn');
    dynamicDom.nextBtn = document.getElementById('next-btn');
    dynamicDom.progressBar = document.getElementById('progress-bar');
    dynamicDom.currentTime = document.getElementById('current-time');
    dynamicDom.totalDuration = document.getElementById('total-duration');
    dynamicDom.volumeSlider = document.getElementById('volume-slider');
    dynamicDom.volumeBtn = document.getElementById('volume-btn');
    dynamicDom.shuffleBtn = document.getElementById('shuffle-btn');
    dynamicDom.repeatBtn = document.getElementById('repeat-btn');
    dynamicDom.visualizerCanvas = document.getElementById('visualizer-canvas');
    dynamicDom.playerTrackTitle = document.querySelector('.player-track-info .title');
    dynamicDom.playerTrackArtist = document.querySelector('.player-track-info .artist');
    dynamicDom.playerQueueList = document.getElementById('player-queue-list');

    // AI/EQ specific dynamic elements
    dynamicDom.aiLyricsBtn = document.getElementById('ai-lyrics-btn');
    dynamicDom.aiInsightsBtn = document.getElementById('ai-insights-btn');
    dynamicDom.eqBtn = document.getElementById('eq-btn');
    dynamicDom.eqPanel = document.getElementById('eq-panel');
    dynamicDom.eqLowSlider = document.getElementById('eq-low-slider');
    dynamicDom.eqMidSlider = document.getElementById('eq-mid-slider');
    dynamicDom.eqHighSlider = document.getElementById('eq-high-slider');

    // Defensive event listener setup (Issue 5)
    if (dynamicDom.playerQueueList) {
        dynamicDom.playerQueueList.addEventListener('click', (e) => {
            const trackItem = e.target.closest('.queue-track-item');
            if (trackItem && trackItem.dataset.trackIndex) {
                const newIndex = parseInt(trackItem.dataset.trackIndex, 10);
                if (newIndex !== state.currentIndex && !isNaN(newIndex)) {
                    state.currentIndex = newIndex;
                    playTrack();
                }
            }
        });
    }

    if (dynamicDom.playPauseBtn) dynamicDom.playPauseBtn.addEventListener('click', () => { if (dom.audioPlayer.src) { state.isPlaying ? dom.audioPlayer.pause() : dom.audioPlayer.play(); } });
    if (dynamicDom.nextBtn) dynamicDom.nextBtn.addEventListener('click', playNext);
    if (dynamicDom.prevBtn) dynamicDom.prevBtn.addEventListener('click', playPrev);
    if (dynamicDom.progressBar) dynamicDom.progressBar.addEventListener('input', e => { if(dom.audioPlayer.src) dom.audioPlayer.currentTime = e.target.value; });
    if (dynamicDom.volumeSlider) dynamicDom.volumeSlider.addEventListener('input', e => { dom.audioPlayer.volume = e.target.value; state.lastVolume = e.target.value > 0 ? e.target.value : state.lastVolume; updateVolumeIcon(); saveState(); });
    if (dynamicDom.volumeBtn) dynamicDom.volumeBtn.addEventListener('click', () => { dom.audioPlayer.volume = dom.audioPlayer.volume > 0 ? 0 : state.lastVolume; dynamicDom.volumeSlider.value = dom.audioPlayer.volume; updateVolumeIcon(); });
    if (dynamicDom.shuffleBtn) dynamicDom.shuffleBtn.addEventListener('click', toggleShuffle);
    if (dynamicDom.repeatBtn) dynamicDom.repeatBtn.addEventListener('click', toggleRepeat);
    
    // --- Equalizer UI Logic ---
    if (dynamicDom.eqBtn && dynamicDom.eqPanel) {
        dynamicDom.eqBtn.addEventListener('click', (e) => {
            e.stopPropagation(); 
            dynamicDom.eqPanel.classList.toggle('active');
            dynamicDom.eqBtn.classList.toggle('active');
        });

        const presetsContainer = dynamicDom.eqPanel.querySelector('.eq-presets-container');
        if (presetsContainer) {
            presetsContainer.innerHTML = Object.keys(EQ_PRESETS).map(key => {
                const preset = EQ_PRESETS[key];
                const isActive = state.settings.activeEqPreset === key ? 'active' : '';
                return `<button class="eq-preset-btn ${isActive}" data-preset="${key}"><i class="fas ${preset.icon}"></i> ${preset.name}</button>`;
            }).join('');
        }


        if (presetsContainer) {
            presetsContainer.querySelectorAll('.eq-preset-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const presetName = e.currentTarget.dataset.preset;
                    applyEqualizerPreset(presetName);
                });
            });
        }


        const handleSliderInput = (slider, band) => {
            if (slider) { // Defensive check for slider (Issue 5)
                slider.addEventListener('input', (e) => {
                    const value = parseFloat(e.target.value);
                    state.settings.customEqValues[band] = value;
                    if (state.eqFilters[band] && state.audioContext) {
                        state.eqFilters[band].gain.setValueAtTime(value, state.audioContext.currentTime);
                    }
                    // Switch to custom preset when a slider is moved
                    applyEqualizerPreset('custom');
                });
            }
        };

        handleSliderInput(dynamicDom.eqLowSlider, 'low');
        handleSliderInput(dynamicDom.eqMidSlider, 'mid');
        handleSliderInput(dynamicDom.eqHighSlider, 'high');
    
        // Close equalizer if clicking outside
        document.body.addEventListener('click', closeEqualizer, true);
        dynamicDom.eqPanel.addEventListener('click', e => e.stopPropagation());
    }
    // --- End Equalizer UI Logic ---


    // AI Button Listeners (Issue 5)
    const handleAiAction = (action) => {
        if (!state.settings.aiFeaturesEnabled) {
            showToast("AI features are disabled in Controls & Settings.", "error");
            hideAiContentModal(); // Close loading modal if it opened too early (Issue 7 UX fix)
            return;
        }

        if (state.currentIndex < 0) {
            showToast("Play a song to use AI features.", "info");
            return;
        }
        const track = state.queue[state.currentIndex];
        const title = state.currentTrackMetadata.title || track.name;
        const artist = state.currentTrackMetadata.artist || "Unknown Artist";
        if (action === 'lyrics') {
            showAiContentModal(`Lyrics for ${title}`);
            getSongLyrics(title, artist);
        } else if (action === 'insights') {
            showAiContentModal(`Insights for ${title}`);
            getSongInsights(title, artist);
        }
    };
    if (dynamicDom.aiLyricsBtn) dynamicDom.aiLyricsBtn.addEventListener('click', () => handleAiAction('lyrics'));
    if (dynamicDom.aiInsightsBtn) dynamicDom.aiInsightsBtn.addEventListener('click', () => handleAiAction('insights'));

    updatePlayPauseIcon();
    updateVolumeIcon();
    if (dynamicDom.shuffleBtn) dynamicDom.shuffleBtn.classList.toggle('active', state.isShuffle);
    if (dynamicDom.repeatBtn) dynamicDom.repeatBtn.className = `btn btn-icon btn-ghost ${state.repeatMode !== 'none' ? 'active' : ''}`;
    toggleRepeat(true); // Call to set initial state without toggling
    toggleShuffle(true); // Call to set initial state without toggling
}

// --- WEB AUDIO API & VISUALIZER ---
function setupAudioContext() {
    if (state.audioContext) return;
    try {
        state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        state.sourceNode = state.audioContext.createMediaElementSource(dom.audioPlayer);
        state.analyser = state.audioContext.createAnalyser();
        state.analyser.fftSize = 256;

        // Create Equalizer filters
        state.eqFilters.low = state.audioContext.createBiquadFilter();
        state.eqFilters.low.type = "lowshelf";
        state.eqFilters.low.frequency.value = 320; 

        state.eqFilters.mid = state.audioContext.createBiquadFilter();
        state.eqFilters.mid.type = "peaking";
        state.eqFilters.mid.frequency.value = 1000; 
        state.eqFilters.mid.Q.value = 1;

        state.eqFilters.high = state.audioContext.createBiquadFilter();
        state.eqFilters.high.type = "highshelf";
        state.eqFilters.high.frequency.value = 3200; 

        // Chain all the nodes together
        state.sourceNode
            .connect(state.eqFilters.low)
            .connect(state.eqFilters.mid)
            .connect(state.eqFilters.high)
            .connect(state.analyser)
            .connect(state.audioContext.destination);
        
        // Apply the saved or default preset
        applyEqualizerPreset(state.settings.activeEqPreset);

    } catch (e) {
        console.error("Could not set up Web Audio API:", e);
        showToast("Audio effects disabled.", "error");
        state.settings.musicVisualizer = false;
    }
}

function drawVisualizer() {
    if (!state.isPlaying || !state.analyser || !dynamicDom.visualizerCanvas || !state.settings.musicVisualizer) {
        if (state.animationFrameId) {
             cancelAnimationFrame(state.animationFrameId);
             state.animationFrameId = null;
        }
        return;
    }
    state.animationFrameId = requestAnimationFrame(drawVisualizer);
    const bufferLength = state.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    state.analyser.getByteFrequencyData(dataArray);
    const canvas = dynamicDom.visualizerCanvas;
    const ctx = canvas.getContext('2d');
    const WIDTH = canvas.width;
    const HEIGHT = canvas.height;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    
    const centerX = WIDTH / 2;
    const centerY = HEIGHT / 2;
    const radius = Math.min(WIDTH, HEIGHT) / 3;
    
    for (let i = 0; i < bufferLength; i++) {
        const barHeight = dataArray[i] / 2.5;
        const angle = (i / bufferLength) * 2 * Math.PI;

        const x1 = centerX + radius * Math.cos(angle);
        const y1 = centerY + radius * Math.sin(angle);
        const x2 = centerX + (radius + barHeight) * Math.cos(angle);
        const y2 = centerY + (radius + barHeight) * Math.sin(angle);

        const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
        const hue = (i / bufferLength) * 360;
        gradient.addColorStop(0, `hsla(${hue}, 100%, 70%, 0)`);
        gradient.addColorStop(0.5, `hsl(${hue}, 100%, 60%)`);
        gradient.addColorStop(1, `hsla(${hue}, 100%, 50%, 0)`);
        
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }
}

// --- PLAYER CORE LOGIC ---

// Tracks the last created blob URL for revocation (Issue 10)
let lastBlobUrl = null;

async function playTrack() {
    if (state.currentIndex < 0 || state.currentIndex >= state.queue.length) return;
    const track = state.queue[state.currentIndex];

    // Revoke the previous object URL to prevent memory leaks (Issue 10)
    if (lastBlobUrl) {
        URL.revokeObjectURL(lastBlobUrl);
        lastBlobUrl = null;
    }

    if (track.source === 'drive' || track.source === 'youtube' || track.source === 'jamendo') {
        showToast(`Loading "${track.name.replace(/\.[^/.]+$/, "")}"...`, 'info');
    }

    try {
        let audioUrl;
        let fileObjectForMetadata = null;
        let metadata = { title: track.name, artist: track.artist || "Unknown Artist", picture: track.thumbnail || null };

        if (track.source === 'local') {
            audioUrl = URL.createObjectURL(track.file);
            lastBlobUrl = audioUrl; // Track the new blob URL
            fileObjectForMetadata = track.file;
        } else if (track.source === 'drive') {
            if (!state.googleDriveSignedIn || !gapi.client.getToken()) throw new Error('Google Drive disconnected.');
            const accessToken = gapi.client.getToken().access_token;
            const fetchResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${track.id}?alt=media`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            if (!fetchResponse.ok) throw new Error(`Google Drive fetch failed: ${fetchResponse.statusText}`);
            const blob = await fetchResponse.blob();
            audioUrl = URL.createObjectURL(blob);
            lastBlobUrl = audioUrl; // Track the new blob URL
            fileObjectForMetadata = new File([blob], track.name, { type: blob.type || 'audio/mpeg' });
        } else if (track.source === 'youtube') {
             // NOTE (Issue 9): YTDL stream URLs may fail due to CORS/browser restrictions.
             // If it fails, the catch block will handle it.
             const info = await ytdl.getInfo(track.id.replace('yt-', ''));
             const format = ytdl.chooseFormat(info.formats, { quality: 'highestaudio' });
             if (!format || !format.url) throw new Error("Could not get streamable URL from YouTube. Try download instead.");
             audioUrl = format.url;
             metadata.title = info.videoDetails.title;
             metadata.artist = info.videoDetails.author.name;
             metadata.picture = info.videoDetails.thumbnails[0].url;
        } else if (track.source === 'jamendo') {
            if (!track.streamUrl) {
                throw new Error("Jamendo track is missing a stream URL.");
            }
            audioUrl = track.streamUrl;
            metadata = { title: track.name, artist: track.artist, picture: track.thumbnail };
            fileObjectForMetadata = null; 
        }
        
        if (fileObjectForMetadata) {
            metadata = await new Promise(resolve => getTrackMetadata(fileObjectForMetadata, resolve));
        }

        state.currentTrackMetadata = metadata;

        if (state.currentView !== 'player') {
            state.currentView = 'player';
            updateActiveNav(state.currentView);
            await renderCurrentView();
        } else {
            updatePlayerUI(track, state.currentTrackMetadata);
        }
        
        setupAudioContext();

        dom.audioPlayer.src = audioUrl;
        await dom.audioPlayer.play();
        addToRecents(track.name);

    } catch (e) { 
        console.error("Playback Error:", e);
        showToast(`Error playing ${track.name}: ${e.message}`, "error");
        
        // Revoke failed blob URL if one was created
        if (lastBlobUrl) {
            URL.revokeObjectURL(lastBlobUrl);
            lastBlobUrl = null;
        }
        
        // Only attempt to play next if the queue is not empty, otherwise it loops endlessly
        if (state.queue.length > 0) {
             setTimeout(playNext, 1000);
        }
    }
}

// --- Equalizer Logic ---
function applyEqualizerPreset(presetName) {
    if (!state.audioContext || !state.eqFilters.low || !EQ_PRESETS[presetName]) return; // Defensive check for EQ filters

    let values;
    if (presetName === 'custom') {
        values = state.settings.customEqValues;
    } else {
        values = EQ_PRESETS[presetName].values;
    }
    
    const { low, mid, high } = values;

    // Apply gain values to filters
    if (state.audioContext) {
        state.eqFilters.low.gain.setValueAtTime(low, state.audioContext.currentTime);
        state.eqFilters.mid.gain.setValueAtTime(mid, state.audioContext.currentTime);
        state.eqFilters.high.gain.setValueAtTime(high, state.audioContext.currentTime);
    }

    // Also update the manual sliders to reflect the current values (Issue 5)
    if (dynamicDom.eqLowSlider) dynamicDom.eqLowSlider.value = low;
    if (dynamicDom.eqMidSlider) dynamicDom.eqMidSlider.value = mid;
    if (dynamicDom.eqHighSlider) dynamicDom.eqHighSlider.value = high;

    // Update state and UI
    state.settings.activeEqPreset = presetName;
    const presetsContainer = dynamicDom.eqPanel ? dynamicDom.eqPanel.querySelector('.eq-presets-container') : null;
    if (presetsContainer) {
        const currentActive = presetsContainer.querySelector('.eq-preset-btn.active');
        if(currentActive) currentActive.classList.remove('active');
        const newActive = presetsContainer.querySelector(`.eq-preset-btn[data-preset="${presetName}"]`);
        if(newActive) newActive.classList.add('active');
    }
    saveState();
}
// --- End Equalizer Logic ---

async function playNext() {
    if (state.queue.length === 0) return;
    if (state.repeatMode === 'one' && state.isPlaying) {
        dom.audioPlayer.currentTime = 0;
        await dom.audioPlayer.play();
        return;
    }

    let nextIndex = state.currentIndex + 1;
    if (nextIndex >= state.queue.length) {
        if (state.repeatMode === 'all') {
            nextIndex = 0;
        } else {
            state.isPlaying = false;
            updatePlayPauseIcon();
            // Revoke object URL on playback stop (Issue 10)
            if (lastBlobUrl) {
                URL.revokeObjectURL(lastBlobUrl);
                lastBlobUrl = null;
            }
            dom.audioPlayer.src = '';
            state.currentIndex = -1;
            return;
        }
    }

    if (state.settings.aiDjEnabled && state.settings.aiFeaturesEnabled && state.currentIndex > -1 && state.queue.length > 1) {
        dom.audioPlayer.pause();
        const currentSong = { title: state.currentTrackMetadata.title, artist: state.currentTrackMetadata.artist };
        const nextTrack = state.queue[nextIndex];
        const nextSong = { title: nextTrack.name.replace(/\.[^/.]+$/, ""), artist: nextTrack.artist || 'Unknown' };

        showToast("AI DJ is preparing the transition...", "info");
        await getAiDjTransition(currentSong, nextSong);
    }
    
    state.currentIndex = nextIndex;
    await playTrack();
}

async function playPrev() {
    if (state.queue.length === 0) return;
    if (dom.audioPlayer.currentTime > 3) {
        dom.audioPlayer.currentTime = 0;
    } else {
        state.currentIndex = (state.currentIndex - 1 + state.queue.length) % state.queue.length;
       await playTrack();
    }
}

function getTrackMetadata(file, callback) { 
    if (!file) {
        callback({ title: "Unknown Track", artist: "Unknown Artist", picture: null });
        return;
    }
   window.jsmediatags.read(file, {
       onSuccess: (tag) => {
           const { tags } = tag;
           let picture = null;
           if (tags.picture) {
               const { data, format } = tags.picture;
               let base64String = "";
               for (let i = 0; i < data.length; i++) { base64String += String.fromCharCode(data[i]); }
               picture = `data:${format};base64,${window.btoa(base64String)}`;
           }
           callback({ title: tags.title || file.name.replace(/\.[^/.]+$/, ""), artist: tags.artist || "Unknown Artist", picture });
       },
       onError: (error) => {
           console.warn('jsmediatags error:', error);
           callback({ title: file.name.replace(/\.[^/.]+$/, ""), artist: "Unknown Artist", picture: null });
       }
   });
}

function updatePlayerUI(track, metadata) { 
    if (dynamicDom.playerTrackTitle) dynamicDom.playerTrackTitle.textContent = metadata.title;
    if (dynamicDom.playerTrackArtist) dynamicDom.playerTrackArtist.textContent = metadata.artist || "Unknown Artist";

    const artworkUrl = metadata.picture || null;
    dom.auraScreenContainer.style.backgroundImage = artworkUrl ? `url(${artworkUrl})` : 'none';
    dom.auraScreenContainer.classList.toggle('player-active', !!artworkUrl);
    
    if (dom.nowPlayingArtwork) dom.nowPlayingArtwork.src = artworkUrl || 'https://placehold.co/40x40/2a2a3a/e0e0e0?text=A'; // Defensive check (Issue 5)
    if (dom.nowPlayingTitle) dom.nowPlayingTitle.textContent = metadata.title; // Defensive check (Issue 5)
    if (dom.nowPlayingArtist) dom.nowPlayingArtist.textContent = metadata.artist || "Unknown Artist"; // Defensive check (Issue 5)

    if (state.currentView === 'player') renderPlayerQueue();
}

function renderPlayerQueue() {
    if (!dynamicDom.playerQueueList) return;
    dynamicDom.playerQueueList.innerHTML = state.queue.map((track, index) => {
        let className = 'queue-track-item';
        if (index < state.currentIndex) className += ' previous';
        if (index === state.currentIndex) className += ' current';
        // Add data-track-index and make it clickable
        return `<li class="${className}" data-track-index="${index}" style="cursor: pointer;" title="Play ${track.name.replace(/\.[^/.]+$/, "")}">
                    ${track.name.replace(/\.[^/.]+$/, "")}
                </li>`;
    }).join('');
    
    const currentItem = dynamicDom.playerQueueList.querySelector('.current');
    if (currentItem) currentItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
}


function formatTime(s) { return isNaN(s) ? '0:00' : `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`; }
function updatePlayPauseIcon() { 
    if(dynamicDom.playPauseBtn && typeof animateIconTransition === 'function') {
        animateIconTransition(dynamicDom.playPauseBtn, { toPressed: state.isPlaying });
    }
    
    // Still need to update the top-bar icon
    if(dom.nowPlayingPlayPauseBtn) { // Defensive check (Issue 5)
        dom.nowPlayingPlayPauseBtn.innerHTML = `<i class="fas ${state.isPlaying ? 'fa-pause' : 'fa-play'}"></i>`;
    }
}
function updateVolumeIcon() { 
    if(!dynamicDom.volumeBtn) return; 
    const v = dom.audioPlayer.volume;
    const i = dynamicDom.volumeBtn.querySelector('i'); 
    const isMuted = v === 0;

    if (i) { // Defensive check for the icon (Issue 5)
        if (isMuted) {
            i.className = 'fas fa-volume-xmark';
        } else if (v < 0.5) {
            i.className = 'fas fa-volume-low';
        } else {
            i.className = 'fas fa-volume-high';
        }
    }
    // Update ARIA state for new button (Issue 12)
    dynamicDom.volumeBtn.setAttribute('aria-pressed', isMuted.toString());
    dynamicDom.volumeBtn.title = isMuted ? 'Unmute' : 'Mute';
}

/**
 * Toggles shuffle state and re-shuffles the queue if turning on.
 * @param {boolean} [setStateOnly=false] - If true, only updates the state and ARIA/UI, without toggling the state.
 */
function toggleShuffle(setStateOnly = false) { 
    if (!setStateOnly) {
        state.isShuffle = !state.isShuffle; 
        showToast(`Shuffle is ${state.isShuffle ? 'ON' : 'OFF'}.`, 'info');
        saveState();
    }
    
    if(dynamicDom.shuffleBtn) {
        // Update ARIA and title (Issue 12)
        dynamicDom.shuffleBtn.setAttribute('aria-pressed', state.isShuffle.toString());
        dynamicDom.shuffleBtn.title = state.isShuffle ? 'Shuffle: On' : 'Shuffle: Off';
        dynamicDom.shuffleBtn.classList.toggle('active', state.isShuffle); 
    }
    
    if (!setStateOnly && state.queue.length > 0) { 
        const currentTrack = state.queue[state.currentIndex]; 
        
        // FIX: Corrected array spread syntax (Issue 1)
        state.queue = state.isShuffle ? shuffleArray([...state.originalQueue]) : [...state.originalQueue]; 
        
        state.currentIndex = state.queue.findIndex(t => t.id === currentTrack.id); 
        // If track is not found (shouldn't happen), prevent negative index
        if (state.currentIndex === -1) state.currentIndex = 0;
    } 
    
    if(!setStateOnly && state.currentView === 'player') renderPlayerQueue(); 
}
function shuffleArray(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }

/**
 * Toggles repeat mode: none -> all -> one.
 * @param {boolean} [setStateOnly=false] - If true, only updates the state and ARIA/UI, without toggling the state.
 */
function toggleRepeat(setStateOnly = false) { 
    if (!setStateOnly) {
        const modes = ['none', 'all', 'one']; 
        state.repeatMode = modes[(modes.indexOf(state.repeatMode) + 1) % modes.length]; 
        showToast(`Repeat mode: ${state.repeatMode}.`, 'info'); 
        saveState(); 
    }
    
    if(dynamicDom.repeatBtn) { 
        const icon = dynamicDom.repeatBtn.querySelector('.icon-wrap');
        const isPressed = state.repeatMode !== 'none';
        
        // Update ARIA and title (Issue 12)
        dynamicDom.repeatBtn.setAttribute('aria-pressed', isPressed.toString());
        dynamicDom.repeatBtn.classList.toggle('active', isPressed); 
        
        if (state.repeatMode === 'one') {
            icon.innerHTML = `<i class="fas fa-repeat" data-mode="one" aria-hidden="true"></i>`;
            dynamicDom.repeatBtn.title = 'Repeat: One';
        } else if (state.repeatMode === 'all') {
            icon.innerHTML = `<i class="fas fa-repeat" data-mode="all" aria-hidden="true"></i>`;
            dynamicDom.repeatBtn.title = 'Repeat: All';
        } else { // none
            icon.innerHTML = `<i class="fas fa-repeat" data-mode="none" aria-hidden="true"></i>`;
            dynamicDom.repeatBtn.title = 'Repeat: Off';
        }
    } 
}


/**
 * Sets the main queue and updates the current index.
 * @param {Array<Object>} tracks - The array of tracks to set as the new queue.
 * @param {number} startIndex - The index of the track to play immediately.
 * @throws {Error} If tracks is invalid or startIndex is out of bounds.
 */
function setQueue(tracks, startIndex) {
    // FIX: Input validation and fallback (Issue 4)
    if (!Array.isArray(tracks) || tracks.length === 0) {
        console.error("Attempted to set an empty or invalid queue.");
        state.originalQueue = [];
        state.queue = [];
        state.currentIndex = -1;
        return;
    }
    
    // Fallback to 0 if startIndex is invalid
    let validatedStartIndex = startIndex;
    if (typeof startIndex !== 'number' || startIndex < 0 || startIndex >= tracks.length) {
        validatedStartIndex = 0;
        console.warn(`Invalid startIndex ${startIndex} provided. Falling back to index 0.`);
    }

    state.originalQueue = [...tracks];
    
    // FIX: Corrected array spread syntax (Issue 1)
    state.queue = state.isShuffle ? shuffleArray([...tracks]) : [...tracks];

    // Find the current track in the potentially shuffled queue
    const startTrack = tracks[validatedStartIndex];
    state.currentIndex = state.queue.findIndex(t => t.id === startTrack.id);

    // Final safety check: if the starting track wasn't found in the queue (e.g., duplicate IDs), force index 0.
    if (state.currentIndex === -1) {
        state.currentIndex = 0;
        console.warn("Could not find start track in queue. Starting at index 0.");
    }
}

function handleTrackListClick(e) {
    const trackItem = e.target.closest('.track-item');
    if (!trackItem) return;

    const trackId = trackItem.dataset.trackId;
    const track = state.library.find(t => t.id === trackId);
    if (!track) return;

    const playAction = e.target.closest('.track-info-main');
    const likeAction = e.target.closest('.like-btn');
    const addToPlaylistAction = e.target.closest('.add-to-playlist-btn');
    const deleteAction = e.target.closest('.delete-from-library-btn');
    const uploadAction = e.target.closest('.upload-to-cloud-btn');
    const downloadAction = e.target.closest('.download-from-cloud-btn');

    if (playAction) {
        let tracklistSource;
        if(state.currentTracklistSource.type === 'library') {
            tracklistSource = state.library;
        } else {
            const playlistTrackIds = new Set(state.playlists[state.currentTracklistSource.name].tracks);
            tracklistSource = state.library.filter(t => playlistTrackIds.has(t.id));
        }

        const trackIndex = tracklistSource.findIndex(t => t.id === trackId);
        if (trackIndex > -1) {
            setQueue(tracklistSource, trackIndex);
            playTrack();
        }
    } else if (likeAction) {
        const likedPlaylist = state.playlists['Liked Songs'];
        const isLiked = likedPlaylist.tracks.includes(track.id);
        if (isLiked) {
            likedPlaylist.tracks = likedPlaylist.tracks.filter(id => id !== track.id);
        } else {
            likedPlaylist.tracks.push(track.id);
        }
        likeAction.classList.toggle('active', !isLiked);
        saveState();
    } else if (addToPlaylistAction) {
        openAddToPlaylistModal(track);
    } else if (deleteAction) {
        showConfirmation('Delete From Library', `Are you sure you want to remove "${track.name}"?`, () => {
            state.library = state.library.filter(t => t.id !== track.id);
            Object.values(state.playlists).forEach(p => {
                p.tracks = p.tracks.filter(id => id !== track.id);
            });
            renderTrackList();
            saveState();
            showToast(`Removed "${track.name}" from library`, 'info');
        });
    } else if (uploadAction) {
        // Defensive check before calling external Drive function (Issue 5)
        if (typeof uploadTrackToDrive === 'function') uploadTrackToDrive(track);
    } else if (downloadAction) {
        // Defensive check before calling external Drive function (Issue 5)
        if (typeof downloadTrackFromCloud === 'function') downloadTrackFromCloud(track);
    }
}

// Smooth icon transitions and accessible state toggles
function animateIconTransition(btn, {toPressed=false} = {}){
  const isPressed = toPressed;
  btn.setAttribute('aria-pressed', isPressed ? 'true' : 'false');
  if(btn.id === 'play-pause-btn'){
    btn.setAttribute('aria-label', isPressed ? 'Pause' : 'Play');
    btn.title = isPressed ? 'Pause' : 'Play';
  }
}

// initUiButtons is deprecated, logic moved into initMusicPlayerView
// No need to keep the empty function in this file.

function applyThemeClass(themeName){
  document.body.classList.remove('aura-default', 'theme-neon-nights', 'theme-forest-calm', 'theme-solar-warm','theme-midnight-rose','theme-ocean-deep');
  document.body.classList.add(themeName);
  state.settings.activeTheme = themeName;
  saveState();
  if (state.currentView === 'theme') {
      const container = document.getElementById('theme-selection-container');
      if (container) {
          container.querySelector('.theme-card.active')?.classList.remove('active');
          container.querySelector(`.theme-card[data-theme-id="${themeName}"]`)?.classList.add('active');
      }
  }
}
