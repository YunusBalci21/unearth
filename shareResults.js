// ============================================
// SHARE RESULTS - Unearth
// Generate and share game results
// ============================================

class ShareResults {
    constructor() {
        this.baseUrl = 'https://unearth.game'; // Update with your actual URL
    }

    // Generate share text from game results
    generateShareText(results) {
        const {
            score = 0,
            correctGuesses = 0,
            totalRounds = 5,
            totalArtifacts = 0,
            streak = 0,
            isDaily = false,
            dailyNumber = null
        } = results;

        // Build emoji row for correct/incorrect
        const emojiRow = this.buildEmojiRow(results.roundResults || [], totalRounds);

        // Header
        let text = '🏺 UNEARTH 🏺\n';

        // Daily challenge header if applicable
        if (isDaily && dailyNumber) {
            text = `🏺 UNEARTH #${dailyNumber} 🏺\n`;
        }

        text += '\n';

        // Score
        text += `Score: ${score.toLocaleString()}\n`;

        // Results row
        text += `${emojiRow} (${correctGuesses}/${totalRounds})\n`;

        // Artifacts found
        text += `⛏️ ${totalArtifacts} artifacts unearthed\n`;

        // Streak (if any)
        if (streak >= 2) {
            text += `🔥 ${streak} round streak!\n`;
        }

        // Performance badge
        const badge = this.getPerformanceBadge(correctGuesses, totalRounds, score);
        if (badge) {
            text += `\n${badge}\n`;
        }

        // Call to action
        text += `\nCan you beat me?\n${this.baseUrl}`;

        return text;
    }

    // Build emoji row from round results
    buildEmojiRow(roundResults, totalRounds) {
        if (roundResults.length === 0) {
            // Fallback if no detailed results
            return '🏺'.repeat(totalRounds);
        }

        return roundResults.map(round => {
            if (round.correct) {
                // Correct guess - show artifacts found indicator
                if (round.artifactsFound <= 1) return '🌟'; // Perfect (0-1 artifacts)
                if (round.artifactsFound <= 2) return '✨'; // Great (2 artifacts)
                if (round.artifactsFound <= 3) return '✅'; // Good (3 artifacts)
                return '☑️'; // OK (4-5 artifacts)
            } else {
                return '❌'; // Wrong
            }
        }).join('');
    }

    // Get performance badge based on results
    getPerformanceBadge(correct, total, score) {
        const percentage = correct / total;

        if (percentage === 1 && score >= 2000) {
            return '🏆 Master Archaeologist!';
        } else if (percentage === 1) {
            return '🥇 Perfect Round!';
        } else if (percentage >= 0.8) {
            return '🥈 Expert Digger!';
        } else if (percentage >= 0.6) {
            return '🥉 Skilled Explorer!';
        } else if (percentage >= 0.4) {
            return '🔍 Learning the Ropes';
        }
        return null;
    }

    // Share using Web Share API (mobile) or clipboard (desktop)
    async share(results) {
        const text = this.generateShareText(results);

        // Try Web Share API first (works great on mobile)
        if (navigator.share && this.isMobileDevice()) {
            try {
                await navigator.share({
                    title: 'UNEARTH - My Results',
                    text: text
                });
                return { success: true, method: 'native' };
            } catch (err) {
                if (err.name === 'AbortError') {
                    return { success: false, method: 'cancelled' };
                }
                // Fall through to clipboard
            }
        }

        // Fallback to clipboard
        return this.copyToClipboard(text);
    }

    // Copy text to clipboard
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return { success: true, method: 'clipboard' };
        } catch (err) {
            // Fallback for older browsers
            try {
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                return { success: true, method: 'clipboard' };
            } catch (fallbackErr) {
                return { success: false, method: 'failed' };
            }
        }
    }

    // Check if mobile device
    isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    // Show share modal with preview
    showShareModal(results) {
        console.log('[ShareResults] showShareModal called with:', results);

        // Remove existing modal if any
        const existing = document.getElementById('share-modal');
        if (existing) existing.remove();

        const text = this.generateShareText(results);
        console.log('[ShareResults] Generated text:', text);

        const modal = document.createElement('div');
        modal.id = 'share-modal';
        modal.innerHTML = `
            <div class="share-backdrop"></div>
            <div class="share-dialog">
                <h2 class="share-title">🏺 Share Your Results</h2>
                <div class="share-preview">${this.escapeHtml(text).replace(/\n/g, '<br>')}</div>
                <div class="share-buttons">
                    <button class="share-btn share-copy" id="share-copy-btn">
                        📋 Copy
                    </button>
                    <button class="share-btn share-twitter" id="share-twitter-btn" title="Share on X">
                        <img src="/public/icons/x.svg" alt="X">
                    </button>
                    <button class="share-btn share-facebook" id="share-facebook-btn" title="Share on Facebook">
                        <img src="/public/icons/facebook.svg" alt="Facebook">
                    </button>
                    <button class="share-btn share-reddit" id="share-reddit-btn" title="Share on Reddit">
                        <img src="/public/icons/reddit.svg" alt="Reddit">
                    </button>
                </div>
                <button class="share-close" id="share-close-btn">×</button>
            </div>
        `;

        // Inject styles if not already present
        this.injectStyles();

        document.body.appendChild(modal);

        // Event listeners
        document.getElementById('share-close-btn').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('share-copy-btn').addEventListener('click', async () => {
            const result = await this.copyToClipboard(text);
            const btn = document.getElementById('share-copy-btn');
            if (result.success) {
                btn.textContent = '✅';
                btn.classList.add('success');
                setTimeout(() => {
                    btn.textContent = '📋 Copy';
                    btn.classList.remove('success');
                }, 2000);
            }

            if (window.audioManager) {
                window.audioManager.playClick();
            }
        });

        document.getElementById('share-twitter-btn').addEventListener('click', () => {
            this.shareToTwitter(text);
            if (window.audioManager) {
                window.audioManager.playClick();
            }
        });

        document.getElementById('share-facebook-btn').addEventListener('click', () => {
            this.shareToFacebook(text);
            if (window.audioManager) {
                window.audioManager.playClick();
            }
        });

        document.getElementById('share-whatsapp-btn').addEventListener('click', () => {
            this.shareToWhatsApp(text);
            if (window.audioManager) {
                window.audioManager.playClick();
            }
        });

        document.getElementById('share-reddit-btn').addEventListener('click', () => {
            this.shareToReddit(text);
            if (window.audioManager) {
                window.audioManager.playClick();
            }
        });

        // Close on backdrop click
        modal.querySelector('.share-backdrop').addEventListener('click', () => {
            this.closeModal();
        });

        // Close on Escape
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }

    // Close the share modal
    closeModal() {
        const modal = document.getElementById('share-modal');
        if (modal) {
            modal.style.opacity = '0';
            setTimeout(() => modal.remove(), 200);
        }

        if (window.audioManager) {
            window.audioManager.playClick();
        }
    }

    // Share to Twitter/X
    shareToTwitter(text) {
        const encoded = encodeURIComponent(text);
        const url = `https://twitter.com/intent/tweet?text=${encoded}`;
        window.open(url, '_blank', 'width=550,height=420');
    }

    // Share to Facebook
    shareToFacebook(text) {
        // Facebook doesn't support pre-filled text well, so we use the share dialog with URL
        // User will need to paste text manually, but we copy it first
        this.copyToClipboard(text);
        const shareUrl = encodeURIComponent(this.baseUrl);
        const url = `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}&quote=${encodeURIComponent(text)}`;
        window.open(url, '_blank', 'width=550,height=420');
    }

    // Share to WhatsApp
    shareToWhatsApp(text) {
        const encoded = encodeURIComponent(text);
        // Use wa.me for universal support (works on both mobile and desktop)
        const url = `https://wa.me/?text=${encoded}`;
        window.open(url, '_blank', 'width=550,height=420');
    }

    // Share to Reddit
    shareToReddit(text) {
        const title = encodeURIComponent('🏺 My UNEARTH Score!');
        const selftext = encodeURIComponent(text);
        const url = `https://www.reddit.com/submit?title=${title}&selftext=true&text=${selftext}`;
        window.open(url, '_blank', 'width=550,height=600');
    }

    // Escape HTML for safe display
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Inject CSS styles
    injectStyles() {
        if (document.getElementById('share-styles')) return;

        const style = document.createElement('style');
        style.id = 'share-styles';
        style.textContent = `
            #share-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 10000;
                display: flex;
                justify-content: center;
                align-items: center;
                transition: opacity 0.2s ease;
            }

            .share-backdrop {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.85);
            }

            .share-dialog {
                position: relative;
                background: linear-gradient(135deg, #1a1208 0%, #2a1f0f 100%);
                border: 2px solid #c9a227;
                border-radius: 16px;
                padding: 30px;
                max-width: 400px;
                width: 90%;
                text-align: center;
                box-shadow: 0 10px 50px rgba(0, 0, 0, 0.5), 0 0 30px rgba(201, 162, 39, 0.2);
                animation: share-appear 0.3s ease;
            }

            @keyframes share-appear {
                from {
                    opacity: 0;
                    transform: scale(0.9);
                }
                to {
                    opacity: 1;
                    transform: scale(1);
                }
            }

            .share-title {
                font-family: 'Cinzel', 'Times New Roman', serif;
                font-size: 24px;
                color: #c9a227;
                margin: 0 0 20px 0;
                letter-spacing: 2px;
            }

            .share-preview {
                background: rgba(0, 0, 0, 0.4);
                border: 1px solid rgba(201, 162, 39, 0.3);
                border-radius: 10px;
                padding: 20px;
                margin-bottom: 20px;
                font-family: 'Courier New', monospace;
                font-size: 14px;
                color: #d4c5a9;
                text-align: left;
                line-height: 1.6;
                white-space: pre-wrap;
                word-break: break-word;
            }

            .share-buttons {
                display: flex;
                flex-direction: row;
                flex-wrap: wrap;
                gap: 10px;
                justify-content: center;
            }

            .share-btn {
                font-family: 'Cinzel', 'Times New Roman', serif;
                font-size: 18px;
                width: 60px;
                height: 60px;
                padding: 0;
                border-radius: 12px;
                cursor: pointer;
                transition: all 0.3s ease;
                border: none;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .share-copy {
                background: linear-gradient(135deg, #c9a227 0%, #a68523 100%);
                color: #1a1208;
                font-weight: 600;
                width: auto;
                padding: 0 20px;
                font-size: 14px;
            }

            .share-copy:hover {
                transform: scale(1.05);
                box-shadow: 0 5px 20px rgba(201, 162, 39, 0.4);
            }

            .share-copy.success {
                background: linear-gradient(135deg, #27c96a 0%, #1e9e52 100%);
            }

            .share-twitter {
                background: #000000;
                color: #ffffff;
                font-weight: bold;
                font-size: 20px;
            }

            .share-twitter:hover {
                background: #333333;
                transform: scale(1.1);
            }

            .share-facebook {
                background: #1877f2;
                color: #ffffff;
                font-weight: bold;
                font-size: 24px;
                font-family: Arial, sans-serif;
            }

            .share-facebook:hover {
                background: #166fe5;
                transform: scale(1.1);
            }

            .share-whatsapp {
                background: #25d366;
                color: #ffffff;
                font-size: 24px;
            }

            .share-whatsapp:hover {
                background: #20bd5a;
                transform: scale(1.1);
            }

            .share-reddit {
                background: #ff4500;
                color: #ffffff;
                font-weight: bold;
                font-size: 20px;
            }

            .share-reddit:hover {
                background: #e63e00;
                transform: scale(1.1);
            }

            .share-close {
                position: absolute;
                top: 10px;
                right: 15px;
                background: none;
                border: none;
                font-size: 28px;
                color: #8a7355;
                cursor: pointer;
                transition: color 0.2s ease;
                line-height: 1;
            }

            .share-close:hover {
                color: #c9a227;
            }

            @media (max-width: 480px) {
                .share-dialog {
                    padding: 20px;
                }
                
                .share-title {
                    font-size: 20px;
                }
                
                .share-preview {
                    font-size: 12px;
                    padding: 15px;
                }
                
                .share-btn {
                    padding: 12px 20px;
                    font-size: 12px;
                }
            }
            
                .share-btn img {
                    width: 28px;
                    height: 28px;
                    pointer-events: none;
                }

                .share-twitter img,
                .share-facebook img,
                .share-reddit img {
                    filter: brightness(0) invert(1);
            }
        `;
        document.head.appendChild(style);
    }
}

// Create singleton instance
const shareResults = new ShareResults();

// Export
export { shareResults, ShareResults };

// Expose to window
window.shareResults = shareResults;
window.showShareModal = (results) => shareResults.showShareModal(results);