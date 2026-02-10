// ============================================
// MENU CONTROLLER - Handles UI interactions
// ============================================

import { lobbyManager, showScreen, formatTime, showCountdown, PLAYER_COLORS, getPlayerColor, setPlayerColor, fetchLeaderboard, submitScore } from './lobbyManager.js';

let isMultiplayer = false;
let gameStartCallback = null;

// ============================================
// INITIALIZE MENU SYSTEM
// ============================================

export function initMenuSystem(onGameStart) {
    gameStartCallback = onGameStart;

    setupMainMenuButtons();
    setupLobbyBrowserButtons();
    setupCreateLobbyButtons();
    setupLobbyRoomButtons();
    setupGameOverButtons();
    setupColorPicker();
    setupLeaderboard();

    // Setup lobby manager callbacks
    setupLobbyCallbacks();

    console.log('[MenuController] Initialized');
}

// ============================================
// MAIN MENU
// ============================================

function setupMainMenuButtons() {
    // Solo Play button
    document.getElementById('solo-play-btn').addEventListener('click', () => {
        isMultiplayer = false;
        startSoloGame();
    });

    // Create Lobby button
    document.getElementById('create-lobby-btn').addEventListener('click', async () => {
        isMultiplayer = true;
        await connectToServer();
        // Pre-fill saved name
        const nameInput = document.getElementById('host-name-input');
        if (nameInput && !nameInput.value) {
            nameInput.value = localStorage.getItem('unearth_name') || '';
        }
        showScreen('create-lobby');
    });

    // Join Lobby button
    document.getElementById('join-lobby-btn').addEventListener('click', async () => {
        isMultiplayer = true;
        await connectToServer();
        lobbyManager.requestLobbyList();
        showScreen('lobby-browser');
    });
}

async function connectToServer() {
    if (!lobbyManager.socket || lobbyManager.socket.readyState !== WebSocket.OPEN) {
        try {
            await lobbyManager.connect();
        } catch (error) {
            alert('Could not connect to server. Make sure the server is running.');
            showScreen('main-menu');
            throw error;
        }
    }
}

function startSoloGame() {
    showScreen('game-container');

    // Hide multiplayer UI elements
    document.getElementById('multiplayer-scores').style.display = 'none';

    if (gameStartCallback) {
        gameStartCallback({
            isMultiplayer: false,
            rounds: 10,
            timePerRound: 0 // No limit for solo
        });
    }
}

// ============================================
// LOBBY BROWSER
// ============================================

let pendingJoinCode = null;

function setupLobbyBrowserButtons() {
    document.getElementById('browser-back-btn').addEventListener('click', () => {
        showScreen('main-menu');
    });

    document.getElementById('refresh-lobbies-btn').addEventListener('click', () => {
        lobbyManager.requestLobbyList();
    });

    document.getElementById('join-by-code-btn').addEventListener('click', () => {
        const code = document.getElementById('join-code-input').value.trim().toUpperCase();
        if (code.length >= 4) {
            pendingJoinCode = code;
            showNameModal();
        }
    });

    // Enter key for join code input
    document.getElementById('join-code-input').addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('join-by-code-btn').click();
        }
    });

    // Name modal buttons
    document.getElementById('name-confirm-btn').addEventListener('click', () => {
        const playerName = document.getElementById('player-name-input').value.trim() || 'Player';
        hideNameModal();

        if (pendingJoinCode) {
            lobbyManager.joinLobby(pendingJoinCode, playerName);
            pendingJoinCode = null;
        }
    });

    document.getElementById('name-cancel-btn').addEventListener('click', () => {
        hideNameModal();
        pendingJoinCode = null;
    });

    // Enter key for name input
    document.getElementById('player-name-input').addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('name-confirm-btn').click();
        } else if (e.key === 'Escape') {
            document.getElementById('name-cancel-btn').click();
        }
    });
}

function showNameModal() {
    const modal = document.getElementById('name-modal');
    const input = document.getElementById('player-name-input');
    modal.style.display = 'flex';
    input.value = '';
    input.focus();
}

function hideNameModal() {
    document.getElementById('name-modal').style.display = 'none';
}

// Function to join lobby from lobby list (called by lobby item buttons)
window.joinLobbyFromList = function(lobbyCode) {
    pendingJoinCode = lobbyCode;
    showNameModal();
};

// ============================================
// CREATE LOBBY
// ============================================

function setupCreateLobbyButtons() {
    document.getElementById('create-back-btn').addEventListener('click', () => {
        showScreen('main-menu');
    });

    // Toggle password field visibility
    document.getElementById('password-enabled').addEventListener('change', (e) => {
        document.getElementById('password-group').style.display =
            e.target.checked ? 'block' : 'none';
    });

    document.getElementById('confirm-create-btn').addEventListener('click', () => {
        const hostName = document.getElementById('host-name-input').value.trim() || 'Host';
        localStorage.setItem('unearth_name', hostName);
        const lobbyName = document.getElementById('lobby-name-input').value.trim() || `${hostName}'s Lobby`;
        const rounds = parseInt(document.getElementById('rounds-select').value);
        const timePerRound = parseInt(document.getElementById('time-select').value);
        const maxPlayers = parseInt(document.getElementById('max-players-select').value);
        const isPrivate = document.getElementById('visibility-select').value === 'private';
        const passwordEnabled = document.getElementById('password-enabled').checked;
        const password = passwordEnabled ? document.getElementById('lobby-password-input').value : null;

        lobbyManager.createLobby({
            hostName,
            lobbyName,
            rounds,
            timePerRound,
            maxPlayers,
            isPrivate,
            password,
            color: getPlayerColor()
        });
    });
}

// ============================================
// LOBBY ROOM
// ============================================

function setupLobbyRoomButtons() {
    document.getElementById('copy-code-btn').addEventListener('click', () => {
        const code = document.getElementById('lobby-code-text').textContent;
        navigator.clipboard.writeText(code).then(() => {
            const btn = document.getElementById('copy-code-btn');
            btn.textContent = '✓ Copied!';
            setTimeout(() => btn.textContent = '📋 Copy Code', 2000);
        });
    });

    document.getElementById('start-game-btn').addEventListener('click', () => {
        lobbyManager.startGame();
    });

    document.getElementById('leave-lobby-btn').addEventListener('click', () => {
        lobbyManager.leaveLobby();
        showScreen('main-menu');
    });
}

// ============================================
// GAME OVER
// ============================================

function setupGameOverButtons() {
    document.getElementById('play-again-btn').addEventListener('click', () => {
        document.getElementById('game-over').style.display = 'none';

        if (isMultiplayer && lobbyManager.currentLobby) {
            // Return to lobby for multiplayer
            showScreen('lobby-room');
            lobbyManager.updateLobbyRoomUI();
        } else {
            // Start new solo game
            startSoloGame();
        }
    });

    document.getElementById('menu-return-btn').addEventListener('click', () => {
        document.getElementById('game-over').style.display = 'none';

        if (isMultiplayer) {
            lobbyManager.leaveLobby();
        }

        showScreen('main-menu');
    });
}

// ============================================
// LOBBY MANAGER CALLBACKS
// ============================================

function setupLobbyCallbacks() {
    lobbyManager.onGameStart = (message) => {
        showScreen('game-container');

        // Show multiplayer UI elements
        document.getElementById('multiplayer-scores').style.display = 'block';

        if (gameStartCallback) {
            gameStartCallback({
                isMultiplayer: true,
                rounds: message.settings.rounds,
                timePerRound: message.settings.timePerRound
            });
        }
    };

    lobbyManager.onRoundStart = (message) => {
        // Update round display
        document.getElementById('round-display').textContent =
            `Round ${message.round}/${message.totalRounds}`;

        // Reset timer display
        if (message.timeLimit > 0) {
            document.getElementById('timer-display').textContent = formatTime(message.timeLimit);
            document.getElementById('timer-display').classList.remove('warning');
        } else {
            document.getElementById('timer-display').textContent = '∞';
        }

        // Trigger round start in game
        if (window.onMultiplayerRoundStart) {
            window.onMultiplayerRoundStart(message);
        }
    };

    lobbyManager.onPlayerGuessed = (message) => {
        // Show notification that player guessed
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 100px;
            left: 50%;
            transform: translateX(-50%);
            background: ${message.isCorrect ? '#4ade80' : '#f87171'};
            color: ${message.isCorrect ? '#000' : '#fff'};
            padding: 10px 20px;
            border-radius: 8px;
            font-weight: bold;
            z-index: 1000;
            animation: fadeOut 2s forwards;
        `;
        notification.textContent = message.isCorrect
            ? `${message.playerName} guessed correctly!`
            : `${message.playerName} guessed wrong`;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 2000);
    };

    lobbyManager.onScoreUpdate = (message) => {
        updateMultiplayerScoreboard(message.standings);

        // Update local score from server (authoritative)
        if (message.scores && lobbyManager.playerId) {
            const serverScore = message.scores[lobbyManager.playerId] || 0;
            if (window.updateScoreFromServer) {
                window.updateScoreFromServer(serverScore);
            }
        }
    };

    lobbyManager.onTimerUpdate = (data) => {
        // Use the server-anchored timer system in game.js
        if (window.syncTimerFromServer) {
            window.syncTimerFromServer(data);
        }
    };

    // All players loaded - NOW start the timer
    lobbyManager.onRoundGo = (data) => {
        if (window.syncTimerFromServer) {
            window.syncTimerFromServer(data);
        }
        // Start the timer in game.js
        if (window.startMultiplayerTimer) {
            window.startMultiplayerTimer();
        }
    };

    lobbyManager.onRoundEnd = (message) => {
        // Show round end results
        if (window.onMultiplayerRoundEnd) {
            window.onMultiplayerRoundEnd(message);
        }
    };

    lobbyManager.onGameEnd = (message) => {
        // Call the game.js handler which populates the podium via showGameResults
        if (window.onMultiplayerGameEnd) {
            window.onMultiplayerGameEnd(message);
        }
        // Also submit multiplayer scores to leaderboard
        if (message.yourScore > 0 && window.submitToLeaderboard) {
            const accuracy = message.totalGuesses > 0
                ? Math.round((message.correctGuesses / message.totalGuesses) * 100)
                : 0;
            window.submitToLeaderboard({
                score: message.yourScore,
                rounds: message.totalRounds || 0,
                correct: message.correctGuesses || 0,
                accuracy
            });
        }
    };
}

// ============================================
// UI HELPERS
// ============================================

function updateMultiplayerScoreboard(standings) {
    const listEl = document.getElementById('scores-list');

    listEl.innerHTML = standings.map((player, index) => {
        const isYou = player.id === lobbyManager.playerId;
        const color = player.color || '#ffd700';
        return `
            <div class="score-entry ${isYou ? 'is-you' : ''}">
                <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:6px;vertical-align:middle;"></span>${index + 1}. ${player.name}</span>
                <span>${player.score}</span>
            </div>
        `;
    }).join('');
}

export function showGameOver(data = {}) {
    const gameOver = document.getElementById('game-over');
    gameOver.style.display = 'flex';

    // Update final score
    document.getElementById('final-score').textContent = data.yourScore || window.gameScore || 0;

    // Update stats
    document.getElementById('stat-correct').textContent = data.correctGuesses || 0;
    document.getElementById('stat-artifacts').textContent = data.totalArtifacts || 0;
    document.getElementById('stat-accuracy').textContent =
        data.totalGuesses > 0
            ? Math.round((data.correctGuesses / data.totalGuesses) * 100) + '%'
            : '0%';

    // Show multiplayer standings if available
    const leaderboard = document.getElementById('final-leaderboard');
    const standingsEl = document.getElementById('final-standings');

    if (data.standings && data.standings.length > 1) {
        leaderboard.style.display = 'inline-block';
        standingsEl.innerHTML = data.standings.map((player, index) => `
            <div class="leaderboard-entry ${index === 0 ? 'winner' : ''}">
                <span class="position">${index + 1}.</span>
                <span>${player.name}</span>
                <span>${player.score}</span>
            </div>
        `).join('');
    } else {
        leaderboard.style.display = 'none';
    }
}

// ============================================
// COLOR PICKER
// ============================================

function setupColorPicker() {
    const pickers = document.querySelectorAll('.color-picker');
    pickers.forEach(picker => {
        // Generate color swatches
        picker.innerHTML = PLAYER_COLORS.map(c =>
            `<div class="color-swatch" data-color="${c}" style="background:${c}" title="${c}"></div>`
        ).join('');

        // Set active color
        const savedColor = getPlayerColor();
        const active = picker.querySelector(`[data-color="${savedColor}"]`);
        if (active) active.classList.add('active');

        // Click handler
        picker.addEventListener('click', (e) => {
            const swatch = e.target.closest('.color-swatch');
            if (!swatch) return;
            picker.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
            swatch.classList.add('active');
            setPlayerColor(swatch.dataset.color);
            if (window.audioManager) window.audioManager.playClick();
        });
    });
}

// ============================================
// LEADERBOARD
// ============================================

function setupLeaderboard() {
    const btn = document.getElementById('leaderboard-btn');
    const overlay = document.getElementById('leaderboard-overlay');
    const closeBtn = document.getElementById('leaderboard-close');

    if (btn) btn.addEventListener('click', async () => {
        if (window.audioManager) window.audioManager.playClick();
        overlay.classList.add('show');
        await refreshLeaderboard();
    });

    if (closeBtn) closeBtn.addEventListener('click', () => {
        overlay.classList.remove('show');
    });

    if (overlay) overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.remove('show');
    });
}

async function refreshLeaderboard() {
    const list = document.getElementById('leaderboard-list');
    if (!list) return;
    list.innerHTML = '<div style="text-align:center;color:#6b5030;padding:40px;">Loading...</div>';

    const data = await fetchLeaderboard();

    // Personal best header
    const bestScore = parseInt(localStorage.getItem('unearth_personal_best') || '0', 10);
    const bestHtml = bestScore > 0
        ? `<div style="text-align:center;padding:12px 0 16px;border-bottom:1px solid rgba(139,105,20,0.2);margin-bottom:8px;">
              <div style="font-family:'Cinzel',serif;font-size:11px;color:#6b5030;letter-spacing:2px;text-transform:uppercase;">Your Best</div>
              <div style="font-family:'Cinzel',serif;font-size:24px;color:#ffd700;margin-top:4px;">${bestScore.toLocaleString()}</div>
           </div>`
        : '';

    if (data.length === 0) {
        list.innerHTML = bestHtml + '<div style="text-align:center;color:#6b5030;padding:40px;">No scores yet. Be the first!</div>';
        return;
    }

    list.innerHTML = bestHtml + data.slice(0, 50).map((entry, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
        const dateStr = new Date(entry.date).toLocaleDateString();
        return `
            <div class="lb-entry ${i < 3 ? 'lb-top' : ''}">
                <span class="lb-rank">${medal}</span>
                <span class="lb-color" style="background:${entry.color || '#ffd700'}"></span>
                <span class="lb-name">${entry.name}</span>
                <span class="lb-details">${entry.correct || 0}/${entry.rounds || 0} correct</span>
                <span class="lb-score">${entry.score.toLocaleString()}</span>
            </div>
        `;
    }).join('');
}

// Called from game.js on game over
window.submitToLeaderboard = async function(scoreData) {
    const playerName = localStorage.getItem('unearth_name') || 'Player';
    const result = await submitScore({
        name: playerName,
        score: scoreData.score,
        rounds: scoreData.rounds,
        correct: scoreData.correct,
        accuracy: scoreData.accuracy,
        color: getPlayerColor()
    });

    if (result && result.rank) {
        const rankEl = document.getElementById('leaderboard-rank');
        if (rankEl) {
            // Append rank info below any existing personal best text
            const existing = rankEl.textContent || '';
            const rankText = `📊 #${result.rank} of ${result.total} on global leaderboard`;
            rankEl.innerHTML = existing
                ? `${existing}<br><span style="font-size:14px;color:#a08060;">${rankText}</span>`
                : rankText;
            rankEl.style.display = 'block';
        }
    }
};

// ============================================
// EXPORTS
// ============================================

export function submitMultiplayerGuess(guess, artifactsFound) {
    if (isMultiplayer) {
        lobbyManager.submitGuess(guess, artifactsFound);
    }
}

export function isMultiplayerGame() {
    return isMultiplayer;
}

export { isMultiplayer };