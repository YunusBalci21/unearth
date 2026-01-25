// ============================================
// AUDIO MANAGER - Sound effects for Unearth
// ============================================

class AudioManager {
    constructor() {
        this.sounds = {};
        this.enabled = true;
        this.volume = 0.5;
        
        // Define all game sounds
        this.soundFiles = {
            dig: './public/sounds/digging.wav',
            throw: './public/sounds/throwing_dirt.wav',
            reveal: './public/sounds/find_treasure.wav',
            correct: './public/sounds/correct.wav',
            incorrect: './public/sounds/incorrect.wav'
        };
        
        this.loaded = false;
    }

    async preload() {
        console.log('[AudioManager] Preloading sounds...');
        
        const loadPromises = Object.entries(this.soundFiles).map(async ([name, path]) => {
            try {
                const audio = new Audio(path);
                audio.volume = this.volume;
                
                // Wait for the audio to be loadable
                await new Promise((resolve, reject) => {
                    audio.addEventListener('canplaythrough', resolve, { once: true });
                    audio.addEventListener('error', reject, { once: true });
                    audio.load();
                });
                
                this.sounds[name] = audio;
                console.log(`[AudioManager] ✓ Loaded: ${name}`);
            } catch (error) {
                console.warn(`[AudioManager] ✗ Failed to load: ${name}`, error);
            }
        });

        await Promise.all(loadPromises);
        this.loaded = true;
        console.log(`[AudioManager] Preload complete: ${Object.keys(this.sounds).length}/${Object.keys(this.soundFiles).length} sounds`);
    }

    play(soundName) {
        if (!this.enabled || !this.sounds[soundName]) {
            return;
        }

        try {
            const sound = this.sounds[soundName];
            
            // Clone the audio for overlapping sounds
            const clone = sound.cloneNode();
            clone.volume = this.volume;
            clone.play().catch(e => {
                // Autoplay might be blocked until user interacts
                console.warn('[AudioManager] Playback blocked:', e.message);
            });
        } catch (error) {
            console.warn(`[AudioManager] Error playing ${soundName}:`, error);
        }
    }

    // Convenience methods
    playDig() {
        this.play('dig');
    }

    playThrow() {
        this.play('throw');
    }

    playReveal() {
        this.play('reveal');
    }

    playCorrect() {
        this.play('correct');
    }

    playIncorrect() {
        this.play('incorrect');
    }

    // Settings
    setVolume(vol) {
        this.volume = Math.max(0, Math.min(1, vol));
        Object.values(this.sounds).forEach(sound => {
            sound.volume = this.volume;
        });
    }

    setEnabled(enabled) {
        this.enabled = enabled;
    }

    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }
}

export const audioManager = new AudioManager();