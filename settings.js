// ============================================
// SETTINGS CONTROLLER - Unearth
// Handles all game settings: audio, visuals, etc.
// ============================================

class SettingsController {
    constructor() {
        // Visual settings
        this.particlesEnabled = true;
        this.screenShakeEnabled = true;

        // Load saved settings
        this.loadSettings();
    }

    // Load settings from localStorage
    loadSettings() {
        const saved = localStorage.getItem('unearth_settings');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                this.particlesEnabled = parsed.particlesEnabled ?? true;
                this.screenShakeEnabled = parsed.screenShakeEnabled ?? true;
            } catch (e) {
                console.warn('[Settings] Failed to load:', e);
            }
        }
    }

    // Save settings to localStorage
    saveSettings() {
        localStorage.setItem('unearth_settings', JSON.stringify({
            particlesEnabled: this.particlesEnabled,
            screenShakeEnabled: this.screenShakeEnabled
        }));
    }

    // Initialize all settings UI hooks
    init() {
        this.initVolumeSliders();
        this.initToggles();
        this.initMenuButtonSounds();
        this.syncUIWithSavedSettings();
        console.log('[Settings] Initialized');
    }

    // ============================================
    // VOLUME SLIDERS
    // ============================================

    initVolumeSliders() {
        // Master Volume
        const masterSlider = document.getElementById('volume-slider');
        const masterValue = document.getElementById('volume-value');
        if (masterSlider) {
            masterSlider.addEventListener('input', function() {
                const value = this.value;
                if (masterValue) masterValue.textContent = value + '%';
                if (window.audioManager) {
                    window.audioManager.setMasterVolume(value / 100);
                }
            });
        }

        // Music Volume
        const musicSlider = document.getElementById('music-slider');
        const musicValue = document.getElementById('music-value');
        if (musicSlider) {
            musicSlider.addEventListener('input', function() {
                const value = this.value;
                if (musicValue) musicValue.textContent = value + '%';
                if (window.audioManager) {
                    window.audioManager.setMusicVolume(value / 100);
                }
            });
        }

        // SFX Volume
        const sfxSlider = document.getElementById('sfx-slider');
        const sfxValue = document.getElementById('sfx-value');
        if (sfxSlider) {
            sfxSlider.addEventListener('input', function() {
                const value = this.value;
                if (sfxValue) sfxValue.textContent = value + '%';
                if (window.audioManager) {
                    window.audioManager.setSFXVolume(value / 100);
                }
            });
        }
    }

    // ============================================
    // TOGGLE SWITCHES
    // ============================================

    initToggles() {
        const self = this;

        // Particles Toggle
        const particlesToggle = document.getElementById('particles-toggle');
        if (particlesToggle) {
            particlesToggle.addEventListener('click', function() {
                this.classList.toggle('active');
                self.particlesEnabled = this.classList.contains('active');
                self.saveSettings();
                self.applyParticlesSetting();

                // Play click sound
                if (window.audioManager) {
                    window.audioManager.playClick();
                }
            });
        }

        // Screen Shake Toggle
        const shakeToggle = document.getElementById('shake-toggle');
        if (shakeToggle) {
            shakeToggle.addEventListener('click', function() {
                this.classList.toggle('active');
                self.screenShakeEnabled = this.classList.contains('active');
                self.saveSettings();

                // Play click sound
                if (window.audioManager) {
                    window.audioManager.playClick();
                }
            });
        }
    }

    // ============================================
    // MENU BUTTON CLICK SOUNDS
    // ============================================

    initMenuButtonSounds() {
        // Add click sound to all menu buttons (main menu only)
        const menuButtons = document.querySelectorAll('#main-menu .menu-btn, #main-menu .icon-btn');

        menuButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                if (window.audioManager) {
                    window.audioManager.playClick();
                }
            });
        });

        // Also add to settings close button
        const settingsClose = document.getElementById('settings-close');
        if (settingsClose) {
            settingsClose.addEventListener('click', () => {
                if (window.audioManager) {
                    window.audioManager.playClick();
                }
            });
        }

        // Back buttons
        const backButtons = document.querySelectorAll('.back-btn');
        backButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                if (window.audioManager) {
                    window.audioManager.playClick();
                }
            });
        });
    }

    // ============================================
    // SYNC UI WITH SAVED SETTINGS
    // ============================================

    syncUIWithSavedSettings() {
        // Sync volume sliders with audioManager
        if (window.audioManager) {
            const volumes = window.audioManager.getVolumes();

            const masterSlider = document.getElementById('volume-slider');
            const masterValue = document.getElementById('volume-value');
            if (masterSlider && masterValue) {
                const val = Math.round(volumes.master * 100);
                masterSlider.value = val;
                masterValue.textContent = val + '%';
            }

            const musicSlider = document.getElementById('music-slider');
            const musicValue = document.getElementById('music-value');
            if (musicSlider && musicValue) {
                const val = Math.round(volumes.music * 100);
                musicSlider.value = val;
                musicValue.textContent = val + '%';
            }

            const sfxSlider = document.getElementById('sfx-slider');
            const sfxValue = document.getElementById('sfx-value');
            if (sfxSlider && sfxValue) {
                const val = Math.round(volumes.sfx * 100);
                sfxSlider.value = val;
                sfxValue.textContent = val + '%';
            }
        }

        // Sync toggles
        const particlesToggle = document.getElementById('particles-toggle');
        if (particlesToggle) {
            if (this.particlesEnabled) {
                particlesToggle.classList.add('active');
            } else {
                particlesToggle.classList.remove('active');
            }
        }

        const shakeToggle = document.getElementById('shake-toggle');
        if (shakeToggle) {
            if (this.screenShakeEnabled) {
                shakeToggle.classList.add('active');
            } else {
                shakeToggle.classList.remove('active');
            }
        }

        // Apply particles setting
        this.applyParticlesSetting();
    }

    // ============================================
    // APPLY SETTINGS
    // ============================================

    applyParticlesSetting() {
        // Toggle particle visibility in menu
        const particleContainer = document.querySelector('.particles-container');
        if (particleContainer) {
            particleContainer.style.display = this.particlesEnabled ? 'block' : 'none';
        }

        // Also for loading screen particles
        const loadingParticles = document.getElementById('loading-particles');
        if (loadingParticles) {
            loadingParticles.style.display = this.particlesEnabled ? 'block' : 'none';
        }

        // Floating artifacts in menu
        const floatingArtifacts = document.querySelector('.floating-artifacts');
        if (floatingArtifacts) {
            floatingArtifacts.style.display = this.particlesEnabled ? 'block' : 'none';
        }
    }

    // Screen shake method (call from game.js when digging)
    doScreenShake(intensity = 5, duration = 100) {
        if (!this.screenShakeEnabled) return;

        const canvas = document.getElementById('canvas');
        if (!canvas) return;

        const originalTransform = canvas.style.transform;
        let startTime = Date.now();

        const shake = () => {
            const elapsed = Date.now() - startTime;
            if (elapsed >= duration) {
                canvas.style.transform = originalTransform;
                return;
            }

            const progress = elapsed / duration;
            const currentIntensity = intensity * (1 - progress);
            const x = (Math.random() - 0.5) * currentIntensity * 2;
            const y = (Math.random() - 0.5) * currentIntensity * 2;

            canvas.style.transform = `translate(${x}px, ${y}px)`;
            requestAnimationFrame(shake);
        };

        shake();
    }

    // Getters for game.js to check settings
    get particles() {
        return this.particlesEnabled;
    }

    get screenShake() {
        return this.screenShakeEnabled;
    }
}

// Create singleton instance
const settingsController = new SettingsController();

// Initialize when DOM is ready AND audioManager exists
function initWhenReady() {
    if (window.audioManager) {
        settingsController.init();
    } else {
        // audioManager not ready yet, wait and retry
        setTimeout(initWhenReady, 100);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWhenReady);
} else {
    initWhenReady();
}

// Export
export { settingsController, SettingsController };

// Expose to window
window.settingsController = settingsController;
window.initSettings = () => settingsController.init();
window.doScreenShake = (intensity, duration) => settingsController.doScreenShake(intensity, duration);