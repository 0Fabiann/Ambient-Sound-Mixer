//audio API
class AudioMixer {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.sounds = new Map(); // Store all loaded sounds
        this.melodies = new Map(); // Store melody tracks
        this.activeMelody = null;
        this.analyser = null;
        this.dataArray = null;
    }

    // Initialize the Web Audio API context
    init() {
        if (this.audioContext) return;

        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

        // Create master gain node
        this.masterGain = this.audioContext.createGain();
        this.masterGain.gain.value = 0.8;
        this.masterGain.connect(this.audioContext.destination);

        // Create analyser for visualizations
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.connect(this.masterGain);
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    }

    // Resume audio context (required after user interaction)
    async resume() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }

    // Load an audio file and create a buffer
    async loadSound(id, url, isLoop = true) {
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

            this.sounds.set(id, {
                buffer: audioBuffer,
                isLoop: isLoop,
                source: null,
                gainNode: null,
                isPlaying: false,
                volume: 0.7
            });

            console.log(`Sound loaded: ${id}`);
            return true;
        } catch (error) {
            console.error(`Failed to load sound ${id}:`, error);
            return false;
        }
    }

    // Load a melody track
    async loadMelody(id, url) {
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

            this.melodies.set(id, {
                buffer: audioBuffer,
                source: null,
                gainNode: null,
                isPlaying: false
            });

            console.log(`Melody loaded: ${id}`);
            return true;
        } catch (error) {
            console.error(`Failed to load melody ${id}:`, error);
            return false;
        }
    }

    // Play an ambient sound
    playSound(id) {
        const sound = this.sounds.get(id);
        if (!sound || sound.isPlaying) return;

        const source = this.audioContext.createBufferSource();
        source.buffer = sound.buffer;
        source.loop = sound.isLoop;

        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = sound.volume;

        source.connect(gainNode);
        gainNode.connect(this.analyser);

        source.start(0);

        sound.source = source;
        sound.gainNode = gainNode;
        sound.isPlaying = true;

        // Handle when sound ends (for non-looping sounds)
        source.onended = () => {
            if (!sound.isLoop) {
                sound.isPlaying = false;
            }
        };

        console.log(`Playing sound: ${id}`);
    }

    // Stop an ambient sound
    stopSound(id) {
        const sound = this.sounds.get(id);
        if (!sound || !sound.isPlaying) return;

        if (sound.source) {
            sound.source.stop();
            sound.source.disconnect();
        }
        if (sound.gainNode) {
            sound.gainNode.disconnect();
        }

        sound.source = null;
        sound.gainNode = null;
        sound.isPlaying = false;

        console.log(`Stopped sound: ${id}`);
    }

    // Toggle sound on/off
    toggleSound(id) {
        const sound = this.sounds.get(id);
        if (!sound) return false;

        if (sound.isPlaying) {
            this.stopSound(id);
        } else {
            this.playSound(id);
        }
        return sound.isPlaying;
    }

    // Set volume for a specific sound (0-100)
    setVolume(id, volume) {
        const sound = this.sounds.get(id);
        if (!sound) return;

        const normalizedVolume = volume / 100;
        sound.volume = normalizedVolume;

        if (sound.gainNode) {
            // Smooth volume transition
            sound.gainNode.gain.linearRampToValueAtTime(
                normalizedVolume,
                this.audioContext.currentTime + 0.1
            );
        }
    }

    // Play a melody track (stops current melody first)
    playMelody(id) {
        // Stop current melody if playing
        if (this.activeMelody) {
            this.stopMelody(this.activeMelody);
        }

        const melody = this.melodies.get(id);
        if (!melody) return;

        const source = this.audioContext.createBufferSource();
        source.buffer = melody.buffer;
        source.loop = true;

        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = 0.5;

        source.connect(gainNode);
        gainNode.connect(this.analyser);

        source.start(0);

        melody.source = source;
        melody.gainNode = gainNode;
        melody.isPlaying = true;
        this.activeMelody = id;

        console.log(`Playing melody: ${id}`);
    }

    // Stop a melody track
    stopMelody(id) {
        const melody = this.melodies.get(id);
        if (!melody || !melody.isPlaying) return;

        if (melody.source) {
            melody.source.stop();
            melody.source.disconnect();
        }
        if (melody.gainNode) {
            melody.gainNode.disconnect();
        }

        melody.source = null;
        melody.gainNode = null;
        melody.isPlaying = false;

        if (this.activeMelody === id) {
            this.activeMelody = null;
        }

        console.log(`Stopped melody: ${id}`);
    }

    // Get frequency data for visualization
    getFrequencyData() {
        if (this.analyser) {
            this.analyser.getByteFrequencyData(this.dataArray);
            return this.dataArray;
        }
        return null;
    }

    // Stop all sounds
    stopAll() {
        this.sounds.forEach((_, id) => this.stopSound(id));
        this.melodies.forEach((_, id) => this.stopMelody(id));
    }
}

// ==================== CANVAS API ====================
class Visualizer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.animationId = null;

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    // Draw frequency bars visualization (transparent background for video to show through)
    drawBars(frequencyData, theme) {
        // Clear canvas completely for transparency (video shows through)
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const barWidth = (this.canvas.width / frequencyData.length) * 2.5;
        let x = 0;

        const gradient = this.ctx.createLinearGradient(0, this.canvas.height, 0, 0);
        if (theme === 'light') {
            gradient.addColorStop(0, 'rgba(29, 78, 216, 0.7)');
            gradient.addColorStop(1, 'rgba(59, 130, 246, 0.3)');
        } else {
            gradient.addColorStop(0, 'rgba(147, 51, 234, 0.7)');
            gradient.addColorStop(1, 'rgba(168, 85, 247, 0.3)');
        }

        for (let i = 0; i < frequencyData.length; i++) {
            const barHeight = (frequencyData[i] / 255) * this.canvas.height * 0.5;

            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(
                x,
                this.canvas.height - barHeight,
                barWidth - 2,
                barHeight
            );

            x += barWidth;
        }
    }

    // Main render function - only draws bars now
    render(audioMixer, theme) {
        const frequencyData = audioMixer.getFrequencyData();
        if (!frequencyData) return;

        this.drawBars(frequencyData, theme);
    }

    // Start animation loop
    start(audioMixer, theme) {
        const animate = () => {
            this.render(audioMixer, theme);
            this.animationId = requestAnimationFrame(() => animate());
        };
        animate();
    }

    // Stop animation
    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}

// ==================== VIDEO API ====================
class VideoBackground {
    constructor(videoId) {
        this.video = document.getElementById(videoId);
        this.isPlaying = false;
        this.videos = {
            light: null,
            dark: null
        };
    }

    // Set video sources for themes
    setVideoSource(theme, url) {
        this.videos[theme] = url;
    }

    // Load and play video for current theme
    async loadVideo(theme) {
        const videoUrl = this.videos[theme];

        if (!videoUrl) {
            console.log(`No video configured for theme: ${theme}`);
            this.hide();
            return;
        }

        try {
            this.video.src = videoUrl;
            this.video.load();

            // Wait for video to be ready
            await new Promise((resolve, reject) => {
                this.video.oncanplaythrough = resolve;
                this.video.onerror = reject;
            });

            this.show();
            await this.play();
            console.log(`Video loaded for theme: ${theme}`);
        } catch (error) {
            console.error('Failed to load video:', error);
            this.hide();
        }
    }

    // Play video
    async play() {
        try {
            this.video.muted = true; // Mute to allow autoplay
            await this.video.play();
            this.isPlaying = true;
        } catch (error) {
            console.error('Video play failed:', error);
        }
    }

    // Pause video
    pause() {
        this.video.pause();
        this.isPlaying = false;
    }

    // Toggle play/pause
    toggle() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
        return this.isPlaying;
    }

    // Show video element
    show() {
        this.video.style.display = 'block';
        this.video.style.opacity = '1';
    }

    // Hide video element
    hide() {
        this.video.style.opacity = '0';
        setTimeout(() => {
            this.video.style.display = 'none';
        }, 500);
    }

    // Set video playback rate
    setPlaybackRate(rate) {
        this.video.playbackRate = rate;
    }

    // Set video opacity
    setOpacity(opacity) {
        this.video.style.opacity = opacity;
    }
}

// ==================== ASSET LOADER ====================
class AssetLoader {
    constructor() {
        this.loadedCount = 0;
        this.totalCount = 0;
        this.onProgress = null;
        this.onComplete = null;
    }

    // Define assets to load for each theme
    getAssetManifest() {
        return {
            light: {
                melodies: {
                    piano: 'assets/audio/light/melodies/piano.wav',
                    flute: 'assets/audio/light/melodies/flute.wav',
                    harp: 'assets/audio/light/melodies/harp.wav',
                    drone: 'assets/audio/light/melodies/drone.wav'
                },
                ambients: {
                    rain: 'assets/audio/light/ambients/rain.wav',
                    birds: 'assets/audio/light/ambients/birds.wav',
                    wind: 'assets/audio/light/ambients/wind.wav',
                    whales: 'assets/audio/light/ambients/whales.wav',
                    crickets: 'assets/audio/light/ambients/crickets.wav',
                    river: 'assets/audio/light/ambients/waterfall.wav'
                },
                video: 'assets/video/light-bg.mp4'
            },
            dark: {
                melodies: {
                    organ: 'assets/audio/dark/melodies/organ.wav',
                    spire: 'assets/audio/dark/melodies/spire.wav',
                    lute: 'assets/audio/dark/melodies/lute.wav',
                    chant: 'assets/audio/dark/melodies/chant.wav'
                },
                ambients: {
                    torch: 'assets/audio/dark/ambients/torch.wav',
                    chains: 'assets/audio/dark/ambients/chains.wav',
                    echo: 'assets/audio/dark/ambients/echo.wav',
                    thunder: 'assets/audio/dark/ambients/thunder.wav',
                    stone: 'assets/audio/dark/ambients/stone.wav',
                    owl: 'assets/audio/dark/ambients/owl.wav'
                },
                video: 'assets/video/dark-bg.mp4'
            }
        };
    }

    // Load all assets for a theme
    async loadThemeAssets(theme, audioMixer, videoBackground) {
        const manifest = this.getAssetManifest()[theme];
        if (!manifest) return;

        const melodyEntries = Object.entries(manifest.melodies);
        const ambientEntries = Object.entries(manifest.ambients);

        this.totalCount = melodyEntries.length + ambientEntries.length;
        this.loadedCount = 0;

        // Load melodies
        for (const [id, url] of melodyEntries) {
            const success = await audioMixer.loadMelody(id, url);
            if (success) this.loadedCount++;
            this.reportProgress();
        }

        // Load ambient sounds
        for (const [id, url] of ambientEntries) {
            const success = await audioMixer.loadSound(id, url);
            if (success) this.loadedCount++;
            this.reportProgress();
        }

        // Set video source
        if (manifest.video) {
            videoBackground.setVideoSource(theme, manifest.video);
        }

        if (this.onComplete) this.onComplete();
    }

    reportProgress() {
        if (this.onProgress) {
            this.onProgress(this.loadedCount, this.totalCount);
        }
    }
}

// ==================== MAIN APPLICATION ====================
class AmbientMixerApp {
    constructor() {
        this.audioMixer = new AudioMixer();
        this.visualizer = null;
        this.videoBackground = null;
        this.assetLoader = new AssetLoader();
        this.currentTheme = null;
        this.isInitialized = false;
    }

    // Initialize the application
    async init() {
        // Initialize audio context (needs user interaction)
        this.audioMixer.init();

        // Initialize visualizer
        this.visualizer = new Visualizer('visualizer-canvas');

        // Initialize video background
        this.videoBackground = new VideoBackground('bg-video');

        this.isInitialized = true;
        console.log('AmbientMixerApp initialized');
    }

    // Set theme and load assets
    async setTheme(theme) {
        if (!this.isInitialized) {
            await this.init();
        }

        // Stop all current sounds
        this.audioMixer.stopAll();
        this.visualizer.stop();

        this.currentTheme = theme;

        // Show loading state
        this.showLoading(true);

        // Load assets for theme
        this.assetLoader.onProgress = (loaded, total) => {
            this.updateLoadingProgress(loaded, total);
        };

        this.assetLoader.onComplete = () => {
            this.showLoading(false);
        };

        await this.assetLoader.loadThemeAssets(theme, this.audioMixer, this.videoBackground);

        // Start visualizer
        this.visualizer.start(this.audioMixer, theme);

        // Load video background
        await this.videoBackground.loadVideo(theme);

        console.log(`Theme set to: ${theme}`);
    }

    // Toggle ambient sound
    toggleSound(soundId) {
        this.audioMixer.resume();
        return this.audioMixer.toggleSound(soundId);
    }

    // Set volume for sound
    setVolume(soundId, volume) {
        this.audioMixer.setVolume(soundId, volume);
    }

    // Select and play melody
    selectMelody(melodyId) {
        this.audioMixer.resume();
        this.audioMixer.playMelody(melodyId);
    }

    // Toggle video background
    toggleVideo() {
        if (this.videoBackground) {
            return this.videoBackground.toggle();
        }
        return false;
    }

    // Reset application
    reset() {
        this.audioMixer.stopAll();
        this.visualizer.stop();
        this.videoBackground.hide();
        this.currentTheme = null;
    }

    // Show/hide loading overlay
    showLoading(show) {
        const loader = document.getElementById('loading-overlay');
        if (loader) {
            loader.classList.toggle('hidden', !show);
        }
    }

    // Update loading progress
    updateLoadingProgress(loaded, total) {
        const progressBar = document.getElementById('loading-progress');
        const progressText = document.getElementById('loading-text');

        if (progressBar) {
            progressBar.style.width = `${(loaded / total) * 100}%`;
        }
        if (progressText) {
            progressText.textContent = `Loading sounds... ${loaded}/${total}`;
        }
    }
}

// Create global app instance
const app = new AmbientMixerApp();


// Export for use in HTML
window.AmbientMixerApp = app;
