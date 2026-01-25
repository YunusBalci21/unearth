// ============================================
// LOBBY MANAGER - Handles multiplayer lobbies
// ============================================

class LobbyManager {
    constructor() {
        this.socket = null;
        this.currentLobby = null;
        this.playerId = null;
        this.playerName = '';
        this.isHost = false;
        this.gameSettings = null;
        
        // Callbacks for game integration
        this.onGameStart = null;
        this.onRoundStart = null;
        this.onPlayerGuessed = null;
        this.onRoundEnd = null;
        this.onGameEnd = null;
        this.onScoreUpdate = null;
        this.onTimerUpdate = null;
    }

    // ============================================
    // CONNECTION
    // ============================================

    connect() {
        return new Promise((resolve, reject) => {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}`;
            
            console.log('[LobbyManager] Connecting to:', wsUrl);
            
            this.socket = new WebSocket(wsUrl);
            
            this.socket.onopen = () => {
                console.log('[LobbyManager] Connected to server');
                resolve();
            };
            
            this.socket.onerror = (error) => {
                console.error('[LobbyManager] Connection error:', error);
                reject(error);
            };
            
            this.socket.onclose = () => {
                console.log('[LobbyManager] Disconnected from server');
                this.handleDisconnect();
            };
            
            this.socket.onmessage = (event) => {
                const message = JSON.parse(event.data);
                this.handleMessage(message);
            };
        });
    }

    disconnect() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    }

    send(type, data = {}) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ type, ...data }));
        }
    }

    // ============================================
    // MESSAGE HANDLING
    // ============================================

    handleMessage(message) {
        console.log('[LobbyManager] Received:', message.type, message);
        
        switch (message.type) {
            case 'connected':
                this.playerId = message.playerId;
                break;
                
            case 'lobby_created':
                this.handleLobbyCreated(message);
                break;
                
            case 'lobby_joined':
                this.handleLobbyJoined(message);
                break;
                
            case 'player_joined':
                this.handlePlayerJoined(message);
                break;
                
            case 'player_left':
                this.handlePlayerLeft(message);
                break;
                
            case 'player_kicked':
                this.handlePlayerKicked(message);
                break;
                
            case 'host_changed':
                this.handleHostChanged(message);
                break;
                
            case 'lobby_list':
                this.handleLobbyList(message);
                break;
                
            case 'error':
                this.handleError(message);
                break;
                
            case 'game_starting':
                this.handleGameStarting(message);
                break;
                
            case 'game_started':
                this.handleGameStarted(message);
                break;
                
            case 'round_start':
                this.handleRoundStart(message);
                break;
                
            case 'player_guessed':
                this.handlePlayerGuessed(message);
                break;
                
            case 'round_end':
                this.handleRoundEnd(message);
                break;
                
            case 'game_end':
                this.handleGameEnd(message);
                break;
                
            case 'score_update':
                this.handleScoreUpdate(message);
                break;
                
            case 'timer_sync':
                this.handleTimerSync(message);
                break;
        }
    }

    handleDisconnect() {
        this.currentLobby = null;
        this.isHost = false;
        // Show disconnection message
        showScreen('main-menu');
        alert('Disconnected from server');
    }

    // ============================================
    // LOBBY ACTIONS
    // ============================================

    createLobby(settings) {
        this.playerName = settings.hostName;
        this.send('create_lobby', {
            hostName: settings.hostName,
            lobbyName: settings.lobbyName,
            maxPlayers: settings.maxPlayers,
            rounds: settings.rounds,
            timePerRound: settings.timePerRound,
            isPrivate: settings.isPrivate,
            password: settings.password || null
        });
    }

    joinLobby(lobbyCode, playerName, password = null) {
        this.playerName = playerName;
        this.send('join_lobby', {
            lobbyCode,
            playerName,
            password
        });
    }

    leaveLobby() {
        this.send('leave_lobby');
        this.currentLobby = null;
        this.isHost = false;
    }

    kickPlayer(playerId) {
        if (this.isHost) {
            this.send('kick_player', { targetId: playerId });
        }
    }

    banPlayer(playerId) {
        if (this.isHost) {
            this.send('ban_player', { targetId: playerId });
        }
    }

    requestLobbyList() {
        this.send('get_lobbies');
    }

    startGame() {
        if (this.isHost) {
            this.send('start_game');
        }
    }

    submitGuess(guess) {
        this.send('submit_guess', { guess });
    }

    // ============================================
    // MESSAGE HANDLERS
    // ============================================

    handleLobbyCreated(message) {
        this.currentLobby = message.lobby;
        this.isHost = true;
        this.gameSettings = {
            rounds: message.lobby.settings.rounds,
            timePerRound: message.lobby.settings.timePerRound
        };
        
        showScreen('lobby-room');
        this.updateLobbyRoomUI();
    }

    handleLobbyJoined(message) {
        this.currentLobby = message.lobby;
        this.isHost = message.lobby.hostId === this.playerId;
        this.gameSettings = {
            rounds: message.lobby.settings.rounds,
            timePerRound: message.lobby.settings.timePerRound
        };
        
        showScreen('lobby-room');
        this.updateLobbyRoomUI();
    }

    handlePlayerJoined(message) {
        if (this.currentLobby) {
            this.currentLobby.players = message.players;
            this.updatePlayersListUI();
        }
    }

    handlePlayerLeft(message) {
        if (this.currentLobby) {
            this.currentLobby.players = message.players;
            this.updatePlayersListUI();
        }
    }

    handlePlayerKicked(message) {
        if (message.playerId === this.playerId) {
            alert('You have been kicked from the lobby');
            this.currentLobby = null;
            showScreen('main-menu');
        } else {
            this.currentLobby.players = message.players;
            this.updatePlayersListUI();
        }
    }

    handleHostChanged(message) {
        this.currentLobby.hostId = message.newHostId;
        this.isHost = message.newHostId === this.playerId;
        this.updateLobbyRoomUI();
    }

    handleLobbyList(message) {
        this.updateLobbyListUI(message.lobbies);
    }

    handleError(message) {
        console.error('[LobbyManager] Error:', message.message);
        alert(message.message);
    }

    handleGameStarting(message) {
        showCountdown(message.countdown);
    }

    handleGameStarted(message) {
        this.gameSettings = message.settings;
        if (this.onGameStart) {
            this.onGameStart(message);
        }
    }

    handleRoundStart(message) {
        if (this.onRoundStart) {
            this.onRoundStart(message);
        }
    }

    handlePlayerGuessed(message) {
        if (this.onPlayerGuessed) {
            this.onPlayerGuessed(message);
        }
    }

    handleRoundEnd(message) {
        if (this.onRoundEnd) {
            this.onRoundEnd(message);
        }
    }

    handleGameEnd(message) {
        if (this.onGameEnd) {
            this.onGameEnd(message);
        }
    }

    handleScoreUpdate(message) {
        if (this.onScoreUpdate) {
            this.onScoreUpdate(message);
        }
    }

    handleTimerSync(message) {
        if (this.onTimerUpdate) {
            this.onTimerUpdate(message.timeRemaining);
        }
    }

    // ============================================
    // UI UPDATES
    // ============================================

    updateLobbyRoomUI() {
        const lobby = this.currentLobby;
        if (!lobby) return;

        // Update title
        document.getElementById('room-title').textContent = lobby.name;
        
        // Update code
        document.getElementById('lobby-code-text').textContent = lobby.code;
        
        // Update settings display
        document.getElementById('setting-rounds').textContent = lobby.settings.rounds;
        document.getElementById('setting-time').textContent = 
            lobby.settings.timePerRound === 0 ? 'No Limit' : 
            formatTime(lobby.settings.timePerRound);
        document.getElementById('setting-max-players').textContent = lobby.settings.maxPlayers;
        
        // Update players list
        this.updatePlayersListUI();
        
        // Show/hide start button based on host status
        const startBtn = document.getElementById('start-game-btn');
        startBtn.style.display = this.isHost ? 'block' : 'none';
        
        // Disable start if not enough players (optional: require 2+)
        // startBtn.disabled = lobby.players.length < 2;
    }

    updatePlayersListUI() {
        const lobby = this.currentLobby;
        if (!lobby) return;

        const listEl = document.getElementById('players-list');
        const countEl = document.getElementById('player-count');
        
        countEl.textContent = `${lobby.players.length}/${lobby.settings.maxPlayers}`;
        
        listEl.innerHTML = lobby.players.map(player => {
            const isHost = player.id === lobby.hostId;
            const isYou = player.id === this.playerId;
            const canKick = this.isHost && !isYou;
            
            return `
                <div class="player-item ${isHost ? 'is-host' : ''}">
                    <div class="player-info">
                        <div class="player-avatar">${player.name.charAt(0).toUpperCase()}</div>
                        <span class="player-name">${player.name}${isYou ? ' (You)' : ''}</span>
                        ${isHost ? '<span class="host-badge">HOST</span>' : ''}
                    </div>
                    ${canKick ? `
                        <div class="player-actions">
                            <button class="kick-btn" onclick="lobbyManager.kickPlayer('${player.id}')">Kick</button>
                            <button class="ban-btn" onclick="lobbyManager.banPlayer('${player.id}')">Ban</button>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    updateLobbyListUI(lobbies) {
        const listEl = document.getElementById('lobby-list');
        
        if (lobbies.length === 0) {
            listEl.innerHTML = '<div class="no-lobbies">No lobbies found. Create one!</div>';
            return;
        }
        
        listEl.innerHTML = lobbies.map(lobby => `
            <div class="lobby-item">
                <div class="lobby-info">
                    <h3>${lobby.name}</h3>
                    <span>${lobby.playerCount}/${lobby.maxPlayers} players • ${lobby.rounds} rounds</span>
                    ${lobby.hasPassword ? '<span class="has-password">🔒</span>' : ''}
                </div>
                <button class="lobby-join-btn" onclick="handleJoinFromBrowser('${lobby.code}', ${lobby.hasPassword})">
                    Join
                </button>
            </div>
        `).join('');
    }
}

// ============================================
// UI HELPER FUNCTIONS
// ============================================

function showScreen(screenId) {
    const screens = ['main-menu', 'lobby-browser', 'create-lobby', 'lobby-room', 'game-container'];
    screens.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.style.display = id === screenId ? (id === 'game-container' ? 'block' : 'flex') : 'none';
        }
    });
}

function showCountdown(seconds) {
    const overlay = document.getElementById('countdown-overlay');
    const numberEl = document.getElementById('countdown-number');
    
    overlay.style.display = 'flex';
    numberEl.textContent = seconds;
    
    const interval = setInterval(() => {
        seconds--;
        if (seconds > 0) {
            numberEl.textContent = seconds;
        } else {
            clearInterval(interval);
            overlay.style.display = 'none';
        }
    }, 1000);
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Store pending join info
let pendingJoinInfo = {
    lobbyCode: null,
    password: null
};

function showPasswordModal(lobbyCode) {
    const modal = document.getElementById('password-modal');
    const input = document.getElementById('modal-password-input');
    const confirmBtn = document.getElementById('modal-confirm-btn');
    const cancelBtn = document.getElementById('modal-cancel-btn');
    
    modal.style.display = 'flex';
    input.value = '';
    input.focus();
    
    const cleanup = () => {
        modal.style.display = 'none';
        confirmBtn.onclick = null;
        cancelBtn.onclick = null;
    };
    
    confirmBtn.onclick = () => {
        const password = input.value;
        cleanup();
        // Store password and show name modal
        pendingJoinInfo.lobbyCode = lobbyCode;
        pendingJoinInfo.password = password;
        showNameModalForJoin();
    };
    
    cancelBtn.onclick = cleanup;
}

function showNameModalForJoin() {
    const modal = document.getElementById('name-modal');
    const input = document.getElementById('player-name-input');
    const confirmBtn = document.getElementById('name-confirm-btn');
    const cancelBtn = document.getElementById('name-cancel-btn');
    
    modal.style.display = 'flex';
    input.value = '';
    input.focus();
    
    const cleanup = () => {
        modal.style.display = 'none';
        // Remove event listeners to prevent duplicates
        confirmBtn.replaceWith(confirmBtn.cloneNode(true));
        cancelBtn.replaceWith(cancelBtn.cloneNode(true));
    };
    
    const newConfirmBtn = document.getElementById('name-confirm-btn');
    const newCancelBtn = document.getElementById('name-cancel-btn');
    
    newConfirmBtn.onclick = () => {
        const playerName = input.value.trim() || 'Player';
        cleanup();
        lobbyManager.joinLobby(pendingJoinInfo.lobbyCode, playerName, pendingJoinInfo.password);
        pendingJoinInfo = { lobbyCode: null, password: null };
    };
    
    newCancelBtn.onclick = () => {
        cleanup();
        pendingJoinInfo = { lobbyCode: null, password: null };
    };
    
    // Handle Enter key
    input.onkeyup = (e) => {
        if (e.key === 'Enter') {
            newConfirmBtn.click();
        } else if (e.key === 'Escape') {
            newCancelBtn.click();
        }
    };
}

function handleJoinFromBrowser(lobbyCode, hasPassword) {
    pendingJoinInfo.lobbyCode = lobbyCode;
    pendingJoinInfo.password = null;
    
    if (hasPassword) {
        showPasswordModal(lobbyCode);
    } else {
        showNameModalForJoin();
    }
}

// ============================================
// INITIALIZE
// ============================================

const lobbyManager = new LobbyManager();

// Make it globally accessible
window.lobbyManager = lobbyManager;
window.showScreen = showScreen;
window.handleJoinFromBrowser = handleJoinFromBrowser;

export { lobbyManager, showScreen, formatTime, showCountdown };
