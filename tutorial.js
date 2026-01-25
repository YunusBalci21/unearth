// ============================================
// TUTORIAL SYSTEM - Unearth
// ============================================

class Tutorial {
    constructor() {
        this.steps = [
            {
                title: "Welcome, Archaeologist! 🏺",
                text: "In Unearth, you'll dig up ancient artifacts and guess which civilization they belong to.",
                video: null, // No video for welcome
                highlight: null,
                position: "center"
            },
            {
                title: "Dig for Artifacts ⛏️",
                text: "Click anywhere on the dirt to dig. Hidden artifacts are buried beneath the surface!",
                video: "./public/tutorial/dig.mp4",
                highlight: null,
                position: "center"
            },
            {
                title: "Discover Artifacts",
                text: "When you dig near an artifact, it will rise up and reveal itself. Each round has 5 hidden artifacts.",
                video: "./public/tutorial/discover.mp4",
                highlight: null,
                position: "center"
            },
            {
                title: "Inspect Your Finds 🔍",
                text: "Click on a revealed artifact to inspect it closely. Look for clues about its origin!",
                video: "./public/tutorial/inspect.mp4",
                highlight: null,
                position: "center"
            },
            {
                title: "Make Your Guess",
                text: "Type your guess for the civilization (e.g., Egypt, Greece, China) and submit. Guess early for more points!",
                video: "./public/tutorial/guess.mp4",
                highlight: null,
                position: "center"
            },
            {
                title: "Scoring System ⭐",
                text: "Fewer artifacts found = More points! Time bonus adds extra points. Wrong guesses lose points.",
                video: null, // Could add scoring animation later
                highlight: null,
                position: "center"
            },
            {
                title: "You're Ready!",
                text: "Good luck on your archaeological expedition! May you unearth history's greatest treasures.",
                video: null,
                highlight: null,
                position: "center"
            }
        ];

        this.currentStep = 0;
        this.isActive = false;
        this.overlay = null;
        this.onComplete = null;
        this.videoElement = null;
    }

    // Check if tutorial has been completed before
    shouldShow() {
        return !localStorage.getItem('unearth_tutorial_completed');
    }

    // Mark tutorial as completed
    markComplete() {
        localStorage.setItem('unearth_tutorial_completed', 'true');
    }

    // Reset tutorial (for "How to Play" button)
    reset() {
        localStorage.removeItem('unearth_tutorial_completed');
    }

    // Start the tutorial
    start(onCompleteCallback = null) {
        this.isActive = true;
        this.currentStep = 0;
        this.onComplete = onCompleteCallback;
        this.createOverlay();
        this.injectStyles();
        this.showStep(0);
    }

    // Create the tutorial overlay DOM
    createOverlay() {
        // Remove existing if any
        const existing = document.getElementById('tutorial-overlay');
        if (existing) existing.remove();

        this.overlay = document.createElement('div');
        this.overlay.id = 'tutorial-overlay';
        this.overlay.innerHTML = `
            <div class="tutorial-backdrop"></div>
            <div class="tutorial-highlight-box" id="tutorial-highlight"></div>
            <div class="tutorial-dialog" id="tutorial-dialog">
                <div class="tutorial-step-indicator" id="tutorial-indicators"></div>
                <div class="tutorial-video-container" id="tutorial-video-container">
                    <video id="tutorial-video" autoplay loop muted playsinline></video>
                </div>
                <h2 class="tutorial-title" id="tutorial-title"></h2>
                <p class="tutorial-text" id="tutorial-text"></p>
                <div class="tutorial-buttons">
                    <button class="tutorial-btn tutorial-skip" id="tutorial-skip">Skip Tutorial</button>
                    <button class="tutorial-btn tutorial-next" id="tutorial-next">Next</button>
                </div>
            </div>
        `;

        document.body.appendChild(this.overlay);
        this.videoElement = document.getElementById('tutorial-video');

        // Event listeners
        document.getElementById('tutorial-skip').addEventListener('click', () => this.end());
        document.getElementById('tutorial-next').addEventListener('click', () => this.nextStep());

        // Keyboard support
        this.keyHandler = (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.nextStep();
            } else if (e.key === 'Escape') {
                this.end();
            }
        };
        document.addEventListener('keydown', this.keyHandler);
    }

    // Inject CSS styles
    injectStyles() {
        if (document.getElementById('tutorial-styles')) return;

        const style = document.createElement('style');
        style.id = 'tutorial-styles';
        style.textContent = `
            #tutorial-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 2000;
                pointer-events: none;
            }

            .tutorial-backdrop {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                pointer-events: auto;
            }

            .tutorial-highlight-box {
                position: absolute;
                border: 3px solid #c9a227;
                border-radius: 12px;
                box-shadow: 
                    0 0 0 9999px rgba(0, 0, 0, 0.8),
                    0 0 30px #c9a227,
                    inset 0 0 20px rgba(201, 162, 39, 0.2);
                pointer-events: none;
                transition: all 0.4s ease;
                display: none;
            }

            .tutorial-highlight-box.pulsing {
                animation: tutorial-pulse 2s ease-in-out infinite;
            }

            @keyframes tutorial-pulse {
                0%, 100% { 
                    box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.8), 0 0 30px #c9a227; 
                }
                50% { 
                    box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.8), 0 0 50px #c9a227, 0 0 80px rgba(201, 162, 39, 0.5); 
                }
            }

            .tutorial-dialog {
                position: absolute;
                left: 50%;
                transform: translateX(-50%);
                background: linear-gradient(135deg, #1a1208 0%, #2a1f0f 100%);
                border: 2px solid #c9a227;
                border-radius: 16px;
                padding: 30px 40px;
                max-width: 550px;
                width: 90%;
                text-align: center;
                pointer-events: auto;
                box-shadow: 
                    0 10px 50px rgba(0, 0, 0, 0.5),
                    0 0 30px rgba(201, 162, 39, 0.2);
                animation: tutorial-dialog-appear 0.3s ease;
            }

            .tutorial-video-container {
                width: 100%;
                margin-bottom: 20px;
                border-radius: 10px;
                overflow: hidden;
                background: #000;
                display: none;
            }

            .tutorial-video-container.has-video {
                display: block;
            }

            #tutorial-video {
                width: 100%;
                height: auto;
                max-height: 250px;
                object-fit: cover;
                display: block;
                border-radius: 8px;
                border: 1px solid rgba(201, 162, 39, 0.3);
            }

            @keyframes tutorial-dialog-appear {
                from {
                    opacity: 0;
                    transform: translateX(-50%) translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateX(-50%) translateY(0);
                }
            }

            .tutorial-dialog.position-top {
                top: auto;
                bottom: 50px;
            }

            .tutorial-dialog.position-bottom {
                top: 50px;
                bottom: auto;
            }

            .tutorial-dialog.position-center {
                top: 50%;
                transform: translate(-50%, -50%);
            }

            .tutorial-step-indicator {
                display: flex;
                justify-content: center;
                gap: 8px;
                margin-bottom: 20px;
            }

            .tutorial-step-dot {
                width: 10px;
                height: 10px;
                border-radius: 50%;
                background: rgba(201, 162, 39, 0.3);
                transition: all 0.3s ease;
            }

            .tutorial-step-dot.active {
                background: #c9a227;
                transform: scale(1.3);
            }

            .tutorial-step-dot.completed {
                background: rgba(201, 162, 39, 0.7);
            }

            .tutorial-title {
                font-family: 'Cinzel', 'Times New Roman', serif;
                font-size: 26px;
                color: #c9a227;
                margin: 0 0 15px 0;
                letter-spacing: 2px;
            }

            .tutorial-text {
                font-family: 'Crimson Text', Georgia, serif;
                font-size: 18px;
                color: #d4c5a9;
                line-height: 1.7;
                margin: 0 0 25px 0;
            }

            .tutorial-buttons {
                display: flex;
                justify-content: center;
                gap: 15px;
            }

            .tutorial-btn {
                font-family: 'Cinzel', 'Times New Roman', serif;
                font-size: 14px;
                padding: 12px 28px;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.3s ease;
                text-transform: uppercase;
                letter-spacing: 2px;
            }

            .tutorial-skip {
                background: transparent;
                border: 1px solid rgba(201, 162, 39, 0.4);
                color: #8a7355;
            }

            .tutorial-skip:hover {
                border-color: #c9a227;
                color: #c9a227;
                background: rgba(201, 162, 39, 0.1);
            }

            .tutorial-next {
                background: linear-gradient(135deg, #c9a227 0%, #a68523 100%);
                border: none;
                color: #1a1208;
                font-weight: 600;
            }

            .tutorial-next:hover {
                transform: scale(1.05);
                box-shadow: 0 5px 20px rgba(201, 162, 39, 0.4);
            }

            /* Responsive */
            @media (max-width: 600px) {
                .tutorial-dialog {
                    padding: 20px 25px;
                    max-width: 95%;
                }
                
                .tutorial-title {
                    font-size: 22px;
                }
                
                .tutorial-text {
                    font-size: 16px;
                }
                
                .tutorial-btn {
                    padding: 10px 20px;
                    font-size: 12px;
                }

                #tutorial-video {
                    max-height: 180px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // Show a specific step
    showStep(stepIndex) {
        const step = this.steps[stepIndex];
        const dialog = document.getElementById('tutorial-dialog');
        const highlight = document.getElementById('tutorial-highlight');
        const title = document.getElementById('tutorial-title');
        const text = document.getElementById('tutorial-text');
        const indicators = document.getElementById('tutorial-indicators');
        const nextBtn = document.getElementById('tutorial-next');
        const videoContainer = document.getElementById('tutorial-video-container');

        // Update content
        title.textContent = step.title;
        text.textContent = step.text;

        // Handle video
        if (step.video) {
            videoContainer.classList.add('has-video');
            this.videoElement.src = step.video;
            this.videoElement.load();
            this.videoElement.play().catch(e => {
                console.log('Video autoplay prevented:', e);
            });
        } else {
            videoContainer.classList.remove('has-video');
            this.videoElement.pause();
            this.videoElement.src = '';
        }

        // Update button text for last step
        nextBtn.textContent = stepIndex === this.steps.length - 1 ? "Start Digging!" : "Next";

        // Update step indicators
        indicators.innerHTML = this.steps.map((_, i) => {
            let className = 'tutorial-step-dot';
            if (i === stepIndex) className += ' active';
            else if (i < stepIndex) className += ' completed';
            return `<div class="${className}"></div>`;
        }).join('');

        // Position dialog based on step
        dialog.className = 'tutorial-dialog position-' + step.position;

        // Handle highlighting
        if (step.highlight) {
            const target = document.getElementById(step.highlight);
            if (target) {
                const rect = target.getBoundingClientRect();
                const padding = 15;

                highlight.style.display = 'block';
                highlight.style.top = (rect.top - padding) + 'px';
                highlight.style.left = (rect.left - padding) + 'px';
                highlight.style.width = (rect.width + padding * 2) + 'px';
                highlight.style.height = (rect.height + padding * 2) + 'px';
                highlight.classList.add('pulsing');
            } else {
                highlight.style.display = 'none';
            }
        } else {
            highlight.style.display = 'none';
            highlight.classList.remove('pulsing');
        }
    }

    // Go to next step
    nextStep() {
        this.currentStep++;

        if (this.currentStep >= this.steps.length) {
            this.end();
        } else {
            this.showStep(this.currentStep);
        }
    }

    // End the tutorial
    end() {
        this.isActive = false;
        this.markComplete();

        // Stop video
        if (this.videoElement) {
            this.videoElement.pause();
            this.videoElement.src = '';
        }

        // Remove keyboard handler
        if (this.keyHandler) {
            document.removeEventListener('keydown', this.keyHandler);
            this.keyHandler = null;
        }

        // Fade out overlay
        if (this.overlay) {
            this.overlay.style.transition = 'opacity 0.3s ease';
            this.overlay.style.opacity = '0';

            setTimeout(() => {
                if (this.overlay) {
                    this.overlay.remove();
                    this.overlay = null;
                }
            }, 300);
        }

        // Callback
        if (this.onComplete) {
            this.onComplete();
        }
    }

    // Check if tutorial is currently active
    get active() {
        return this.isActive;
    }
}

// Create singleton instance
const tutorial = new Tutorial();

// Export for ES modules
export { tutorial, Tutorial };

// Also expose to window for non-module usage
window.tutorial = tutorial;