// ============================================
// MENU CONTROLLER - Handles UI interactions
// ============================================

import { lobbyManager, showScreen, formatTime, showCountdown } from './lobbyManager.js';

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
            password
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
    };

    lobbyManager.onTimerUpdate = (timeRemaining) => {
        const timerEl = document.getElementById('timer-display');
        timerEl.textContent = formatTime(timeRemaining);
        
        // Add warning class when low on time
        if (timeRemaining <= 10) {
            timerEl.classList.add('warning');
        }
    };

    lobbyManager.onRoundEnd = (message) => {
        // Show round end results
        if (window.onMultiplayerRoundEnd) {
            window.onMultiplayerRoundEnd(message);
        }
    };

    lobbyManager.onGameEnd = (message) => {
        showGameOver(message);
    };
}

// ============================================
// UI HELPERS
// ============================================

function updateMultiplayerScoreboard(standings) {
    const listEl = document.getElementById('scores-list');
    
    listEl.innerHTML = standings.map((player, index) => {
        const isYou = player.id === lobbyManager.playerId;
        return `
            <div class="score-entry ${isYou ? 'is-you' : ''}">
                <span>${index + 1}. ${player.name}</span>
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
// EXPORTS
// ============================================

export function submitMultiplayerGuess(guess) {
    if (isMultiplayer) {
        lobbyManager.submitGuess(guess);
    }
}

export function isMultiplayerGame() {
    return isMultiplayer;
}

export { isMultiplayer };
