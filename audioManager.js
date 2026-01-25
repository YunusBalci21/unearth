// ============================================
// AUDIO MANAGER - Unearth
// Handles all game audio: music, ambience, SFX
// ============================================

class AudioManager {
    constructor() {
        // Sound effects
        this.sounds = {
            dig: null,
            throw: null,
            reveal: null,
            correct: null,
            incorrect: null,
            notification: null,
            click: null,        // Menu button clicks
            bonfire: null       // Ambient bonfire (SFX category)
        };

        // Music tracks
        this.menuMusic = null;          // intro_main.mp3 - menu theme
        this.gameMusic = null;          // intro_sound1.mp3 - gameplay track

        // State
        this.musicEnabled = true;
        this.sfxEnabled = true;
        this.masterVolume = 0.5;
        this.musicVolume = 0.3;
        this.sfxVolume = 0.7;
        this.isMenuMusicPlaying = false;
        this.isGameMusicPlaying = false;
        this.isSpedUp = false;

        // Load saved preferences
        this.loadPreferences();
    }

    // Load user preferences from localStorage
    loadPreferences() {
        const prefs = localStorage.getItem('unearth_audio_prefs');
        if (prefs) {
            try {
                const parsed = JSON.parse(prefs);
                this.musicEnabled = parsed.musicEnabled ?? true;
                this.sfxEnabled = parsed.sfxEnabled ?? true;
                this.masterVolume = parsed.masterVolume ?? 0.5;
                this.musicVolume = parsed.musicVolume ?? 0.3;
                this.sfxVolume = parsed.sfxVolume ?? 0.7;
            } catch (e) {
                console.warn('[Audio] Failed to load preferences:', e);
            }
        }
    }

    // Save preferences to localStorage
    savePreferences() {
        localStorage.setItem('unearth_audio_prefs', JSON.stringify({
            musicEnabled: this.musicEnabled,
            sfxEnabled: this.sfxEnabled,
            masterVolume: this.masterVolume,
            musicVolume: this.musicVolume,
            sfxVolume: this.sfxVolume
        }));
    }

    // Preload all audio files
    async preload() {
        console.log('[Audio] Preloading sounds...');

        // Sound effects
        this.sounds.dig = await this.loadAudio('./public/sounds/digging.wav');
        this.sounds.throw = await this.loadAudio('./public/sounds/throwing_dirt.wav');
        this.sounds.reveal = await this.loadAudio('./public/sounds/find_treasure.wav');
        this.sounds.correct = await this.loadAudio('./public/sounds/correct.wav');
        this.sounds.incorrect = await this.loadAudio('./public/sounds/incorrect.wav');
        this.sounds.notification = await this.loadAudio('./public/sounds/notification.wav');
        this.sounds.click = await this.loadAudio('./public/sounds/clicking.wav');
        this.sounds.bonfire = await this.loadAudio('./public/sounds/bonfire.mp3', true); // Loop

        // Music tracks
        this.menuMusic = await this.loadAudio('./public/sounds/intro_main.mp3', true);
        this.gameMusic = await this.loadAudio('./public/sounds/intro_sound1.mp3', true);

        console.log('[Audio] All sounds loaded');
    }

    // Load a single audio file
    loadAudio(src, loop = false) {
        return new Promise((resolve) => {
            const audio = new Audio();
            audio.src = src;
            audio.loop = loop;
            audio.preload = 'auto';

            audio.addEventListener('canplaythrough', () => resolve(audio), { once: true });
            audio.addEventListener('error', (e) => {
                console.warn(`[Audio] Failed to load: ${src}`, e);
                resolve(null);
            });

            // Start loading
            audio.load();

            // Timeout fallback
            setTimeout(() => resolve(audio), 3000);
        });
    }

    // ============================================
    // MENU MUSIC
    // ============================================

    startMenuMusic() {
        if (!this.musicEnabled) return;

        // Stop any game music first
        this.stopGameMusic();

        // Check if already playing
        const musicPlaying = this.menuMusic && !this.menuMusic.paused;
        const bonfirePlaying = this.sounds.bonfire && !this.sounds.bonfire.paused;

        if (musicPlaying && bonfirePlaying) {
            return; // Already playing
        }

        console.log('[Audio] Starting menu music');
        this.isMenuMusicPlaying = true;

        // Play bonfire ambience (SFX category)
        if (this.sounds.bonfire && this.sounds.bonfire.paused) {
            this.sounds.bonfire.volume = this.sfxVolume * this.masterVolume * 0.4;
            this.sounds.bonfire.currentTime = 0;
            this.sounds.bonfire.play().catch(e => {
                console.log('[Audio] Bonfire autoplay blocked');
            });
        }

        // Play menu theme
        if (this.menuMusic && this.menuMusic.paused) {
            this.menuMusic.volume = this.musicVolume * this.masterVolume * 0.8;
            this.menuMusic.currentTime = 0;
            this.menuMusic.play().catch(e => {
                console.log('[Audio] Menu music autoplay blocked');
            });
        }
    }

    stopMenuMusic() {
        if (!this.isMenuMusicPlaying) return;

        console.log('[Audio] Stopping menu music');
        this.isMenuMusicPlaying = false;

        // Fade out bonfire
        if (this.sounds.bonfire) {
            this.fadeOut(this.sounds.bonfire, 500);
        }

        // Fade out menu music
        if (this.menuMusic) {
            this.fadeOut(this.menuMusic, 500);
        }
    }

    // ============================================
    // GAME MUSIC
    // ============================================

    startGameMusic() {
        if (!this.musicEnabled) return;

        // Check if already playing
        if (this.gameMusic && !this.gameMusic.paused) {
            return;
        }

        console.log('[Audio] Starting game music');
        this.isGameMusicPlaying = true;
        this.isSpedUp = false;

        // Stop menu music first
        this.stopMenuMusic();

        if (!this.gameMusic) return;

        this.gameMusic.volume = this.musicVolume * this.masterVolume * 0.6;
        this.gameMusic.playbackRate = 1.0;
        this.gameMusic.currentTime = 0;
        this.gameMusic.play().catch(e => console.log('[Audio] Game music autoplay blocked'));
    }

    stopGameMusic() {
        if (!this.isGameMusicPlaying) return;

        console.log('[Audio] Stopping game music');
        this.isGameMusicPlaying = false;
        this.isSpedUp = false;

        if (this.gameMusic) {
            this.fadeOut(this.gameMusic, 500);
            this.gameMusic.playbackRate = 1.0;
        }
    }

    // Speed up music when timer is low
    setUrgentMode(urgent) {
        if (!this.gameMusic || !this.isGameMusicPlaying) return;

        if (urgent && !this.isSpedUp) {
            console.log('[Audio] Entering urgent mode - speeding up music');
            this.isSpedUp = true;

            // Gradually speed up
            this.animatePlaybackRate(this.gameMusic, 1.0, 1.25, 500);

            // Also increase volume slightly for tension
            const targetVolume = Math.min(this.musicVolume * this.masterVolume * 0.8, 1.0);
            this.animateVolume(this.gameMusic, this.gameMusic.volume, targetVolume, 500);
        } else if (!urgent && this.isSpedUp) {
            console.log('[Audio] Exiting urgent mode - normal speed');
            this.isSpedUp = false;

            // Return to normal
            this.animatePlaybackRate(this.gameMusic, this.gameMusic.playbackRate, 1.0, 300);
            this.animateVolume(this.gameMusic, this.gameMusic.volume, this.musicVolume * this.masterVolume * 0.6, 300);
        }
    }

    // ============================================
    // SOUND EFFECTS
    // ============================================

    playClick() {
        this.playSFX(this.sounds.click, 0.5);
    }

    playDig() {
        this.playSFX(this.sounds.dig);
    }

    playThrow() {
        this.playSFX(this.sounds.throw);
    }

    playReveal() {
        this.playSFX(this.sounds.reveal);
    }

    playCorrect() {
        this.playSFX(this.sounds.correct);
    }

    playIncorrect() {
        this.playSFX(this.sounds.incorrect);
    }

    playNotification() {
        this.playSFX(this.sounds.notification);
    }

    playSFX(audio, volumeMultiplier = 1.0) {
        if (!this.sfxEnabled || !audio) return;

        // Clone for overlapping sounds
        const sound = audio.cloneNode();
        sound.volume = this.sfxVolume * this.masterVolume * volumeMultiplier;
        sound.play().catch(() => {});
    }

    // ============================================
    // VOLUME CONTROLS
    // ============================================

    setMasterVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));
        this.savePreferences();
        this.updateAllVolumes();
    }

    setMusicVolume(volume) {
        this.musicVolume = Math.max(0, Math.min(1, volume));
        this.savePreferences();
        this.updateAllVolumes();
    }

    setSFXVolume(volume) {
        this.sfxVolume = Math.max(0, Math.min(1, volume));
        this.savePreferences();
        this.updateAllVolumes();
    }

    updateAllVolumes() {
        // Update menu music
        if (this.menuMusic && !this.menuMusic.paused) {
            this.menuMusic.volume = this.musicVolume * this.masterVolume * 0.8;
        }

        // Update game music
        if (this.gameMusic && !this.gameMusic.paused) {
            const multiplier = this.isSpedUp ? 0.8 : 0.6;
            this.gameMusic.volume = this.musicVolume * this.masterVolume * multiplier;
        }

        // Update bonfire (SFX)
        if (this.sounds.bonfire && !this.sounds.bonfire.paused) {
            this.sounds.bonfire.volume = this.sfxVolume * this.masterVolume * 0.4;
        }
    }

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================

    fadeOut(audio, duration = 500) {
        if (!audio) return;

        const startVolume = audio.volume;
        const steps = 20;
        const stepTime = duration / steps;
        const volumeStep = startVolume / steps;

        let step = 0;
        const fade = setInterval(() => {
            step++;
            audio.volume = Math.max(0, startVolume - (volumeStep * step));

            if (step >= steps) {
                clearInterval(fade);
                audio.pause();
                audio.volume = startVolume; // Reset for next play
            }
        }, stepTime);
    }

    fadeIn(audio, targetVolume, duration = 500) {
        if (!audio) return;

        audio.volume = 0;
        audio.play().catch(() => {});

        const steps = 20;
        const stepTime = duration / steps;
        const volumeStep = targetVolume / steps;

        let step = 0;
        const fade = setInterval(() => {
            step++;
            audio.volume = Math.min(targetVolume, volumeStep * step);

            if (step >= steps) {
                clearInterval(fade);
            }
        }, stepTime);
    }

    animateVolume(audio, from, to, duration) {
        if (!audio) return;

        const steps = 20;
        const stepTime = duration / steps;
        const volumeStep = (to - from) / steps;

        let step = 0;
        const animate = setInterval(() => {
            step++;
            audio.volume = Math.max(0, Math.min(1, from + (volumeStep * step)));

            if (step >= steps) {
                clearInterval(animate);
            }
        }, stepTime);
    }

    animatePlaybackRate(audio, from, to, duration) {
        if (!audio) return;

        const steps = 20;
        const stepTime = duration / steps;
        const rateStep = (to - from) / steps;

        let step = 0;
        const animate = setInterval(() => {
            step++;
            audio.playbackRate = from + (rateStep * step);

            if (step >= steps) {
                clearInterval(animate);
                audio.playbackRate = to;
            }
        }, stepTime);
    }

    // ============================================
    // TOGGLE CONTROLS
    // ============================================

    toggleMusic() {
        this.musicEnabled = !this.musicEnabled;
        this.savePreferences();

        if (!this.musicEnabled) {
            this.stopMenuMusic();
            this.stopGameMusic();
        }

        return this.musicEnabled;
    }

    toggleSFX() {
        this.sfxEnabled = !this.sfxEnabled;
        this.savePreferences();

        // Stop bonfire if SFX disabled
        if (!this.sfxEnabled && this.sounds.bonfire) {
            this.sounds.bonfire.pause();
        }

        return this.sfxEnabled;
    }

    muteAll() {
        this.musicEnabled = false;
        this.sfxEnabled = false;
        this.stopMenuMusic();
        this.stopGameMusic();
        this.savePreferences();
    }

    unmuteAll() {
        this.musicEnabled = true;
        this.sfxEnabled = true;
        this.savePreferences();
    }

    // Check if any music is playing
    get isMusicPlaying() {
        return this.isMenuMusicPlaying || this.isGameMusicPlaying;
    }

    // Get current volume levels (for UI sync)
    getVolumes() {
        return {
            master: this.masterVolume,
            music: this.musicVolume,
            sfx: this.sfxVolume
        };
    }
}

// Create singleton instance
const audioManager = new AudioManager();

// Export
export { audioManager, AudioManager };

// Expose to window for debugging
window.audioManager = audioManager;