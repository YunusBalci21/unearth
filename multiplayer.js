// ============================================
// MULTIPLAYER CLIENT - Add to game.js
// ============================================
//
// Import this and call initMultiplayer() after init()
//
// ============================================

let socket = null;
let roomCode = null;
let isHost = false;
let players = new Map();

export function initMultiplayer() {
    // Add Socket.io script to page
    const script = document.createElement('script');
    script.src = 'https://cdn.socket.io/4.7.2/socket.io.min.js';
    script.onload = () => {
        socket = io();
        setupSocketEvents();
        showLobbyUI();
    };
    document.head.appendChild(script);
}

function setupSocketEvents() {
    socket.on('connect', () => {
        console.log('Connected to server');
    });

    socket.on('player-joined', (data) => {
        updatePlayerList(data.players);
        showNotification(`${data.playerName} joined!`);
    });

    socket.on('player-left', (data) => {
        updatePlayerList(data.players);
    });

    socket.on('round-start', (data) => {
        hideLobbyUI();
        startMultiplayerRound(data);
    });

    socket.on('artifact-revealed', (data) => {
        // Someone else dug up an artifact
        if (data.playerId !== socket.id) {
            revealArtifactRemote(data.spotIndex, data.playerName);
        }
    });

    socket.on('guess-result', (data) => {
        if (data.playerId !== socket.id) {
            showNotification(
                `${data.playerName} guessed ${data.correct ? 'correctly!' : 'wrong!'}`
            );
        }
        updateScoreboard();
    });

    socket.on('round-end', (data) => {
        showRoundResults(data.correctAnswer, data.leaderboard);
    });

    socket.on('game-over', (data) => {
        showGameOver(data.leaderboard);
    });
}

// ============================================
// LOBBY UI
// ============================================

function showLobbyUI() {
    // Create lobby overlay
    const lobby = document.createElement('div');
    lobby.id = 'lobby-overlay';
    lobby.innerHTML = `
        <div class="lobby-panel">
            <h1>UNEARTH</h1>
            <p>Dig. Discover. Guess.</p>
            
            <div class="lobby-tabs">
                <button class="tab-btn active" data-tab="create">Create Game</button>
                <button class="tab-btn" data-tab="join">Join Game</button>
            </div>
            
            <div class="tab-content" id="create-tab">
                <input type="text" id="host-name" placeholder="Your name" maxlength="20">
                <button id="create-btn" class="primary-btn">Create Room</button>
            </div>
            
            <div class="tab-content hidden" id="join-tab">
                <input type="text" id="join-name" placeholder="Your name" maxlength="20">
                <input type="text" id="room-code-input" placeholder="Room code" maxlength="6">
                <button id="join-btn" class="primary-btn">Join Room</button>
            </div>
            
            <div id="room-info" class="hidden">
                <h2>Room: <span id="display-room-code"></span></h2>
                <div id="player-list"></div>
                <button id="start-btn" class="primary-btn hidden">Start Game</button>
                <p class="waiting-text">Waiting for host to start...</p>
            </div>
        </div>
    `;
    
    document.body.appendChild(lobby);
    
    // Add lobby styles
    const style = document.createElement('style');
    style.textContent = `
        #lobby-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.9);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        }
        .lobby-panel {
            background: #1a1a2e;
            padding: 40px;
            border-radius: 20px;
            text-align: center;
            min-width: 400px;
            color: white;
        }
        .lobby-panel h1 {
            font-size: 48px;
            margin-bottom: 10px;
            background: linear-gradient(135deg, #ffd700, #ff8c00);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .lobby-panel p {
            opacity: 0.7;
            margin-bottom: 30px;
        }
        .lobby-tabs {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
        }
        .tab-btn {
            flex: 1;
            padding: 12px;
            background: #2a2a3e;
            border: none;
            color: white;
            cursor: pointer;
            border-radius: 8px;
        }
        .tab-btn.active {
            background: #ffd700;
            color: #1a1a2e;
        }
        .tab-content {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }
        .tab-content.hidden {
            display: none;
        }
        .tab-content input {
            padding: 15px;
            border: 2px solid #444;
            border-radius: 8px;
            background: #2a2a3e;
            color: white;
            font-size: 16px;
        }
        .primary-btn {
            padding: 15px 30px;
            background: linear-gradient(135deg, #ffd700, #ff8c00);
            border: none;
            border-radius: 8px;
            color: #1a1a2e;
            font-weight: bold;
            font-size: 18px;
            cursor: pointer;
        }
        .primary-btn:hover {
            transform: scale(1.02);
        }
        #room-info {
            margin-top: 20px;
        }
        #display-room-code {
            font-family: monospace;
            font-size: 32px;
            color: #ffd700;
            letter-spacing: 4px;
        }
        #player-list {
            margin: 20px 0;
            text-align: left;
        }
        .player-item {
            padding: 10px;
            background: #2a2a3e;
            margin: 5px 0;
            border-radius: 5px;
            display: flex;
            justify-content: space-between;
        }
        .player-item.host::after {
            content: 'HOST';
            color: #ffd700;
            font-size: 12px;
        }
        .waiting-text {
            opacity: 0.5;
            font-style: italic;
        }
    `;
    document.head.appendChild(style);
    
    // Event listeners
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
            btn.classList.add('active');
            document.getElementById(`${btn.dataset.tab}-tab`).classList.remove('hidden');
        });
    });
    
    document.getElementById('create-btn').addEventListener('click', createRoom);
    document.getElementById('join-btn').addEventListener('click', joinRoom);
    document.getElementById('start-btn').addEventListener('click', startGame);
}

function createRoom() {
    const name = document.getElementById('host-name').value.trim();
    if (!name) {
        alert('Please enter your name');
        return;
    }
    
    socket.emit('create-room', name, (response) => {
        if (response.success) {
            roomCode = response.roomCode;
            isHost = true;
            showRoomInfo(response.roomCode, response.players);
        }
    });
}

function joinRoom() {
    const name = document.getElementById('join-name').value.trim();
    const code = document.getElementById('room-code-input').value.trim().toUpperCase();
    
    if (!name || !code) {
        alert('Please enter your name and room code');
        return;
    }
    
    socket.emit('join-room', { roomCode: code, playerName: name }, (response) => {
        if (response.success) {
            roomCode = response.roomCode;
            isHost = false;
            showRoomInfo(response.roomCode, response.players);
        } else {
            alert(response.error);
        }
    });
}

function showRoomInfo(code, playerList) {
    document.getElementById('create-tab').classList.add('hidden');
    document.getElementById('join-tab').classList.add('hidden');
    document.querySelector('.lobby-tabs').classList.add('hidden');
    document.getElementById('room-info').classList.remove('hidden');
    document.getElementById('display-room-code').textContent = code;
    
    if (isHost) {
        document.getElementById('start-btn').classList.remove('hidden');
        document.querySelector('.waiting-text').classList.add('hidden');
    }
    
    updatePlayerList(playerList);
}

function updatePlayerList(playerList) {
    const container = document.getElementById('player-list');
    if (!container) return;
    
    container.innerHTML = playerList.map(p => `
        <div class="player-item ${p.isHost ? 'host' : ''}">
            <span>${p.name}</span>
            <span>${p.score} pts</span>
        </div>
    `).join('');
}

function startGame() {
    socket.emit('start-game', (response) => {
        if (!response.success) {
            alert(response.error);
        }
    });
}

function hideLobbyUI() {
    const lobby = document.getElementById('lobby-overlay');
    if (lobby) lobby.remove();
}

// ============================================
// MULTIPLAYER GAME FUNCTIONS
// ============================================

function startMultiplayerRound(data) {
    // Use the data from server to set up the round
    // data contains: round, terrain, digSpots, artifacts
    
    // Update game state with server data
    window.currentCountryName = data.terrain;
    window.serverDigSpots = data.digSpots;
    window.serverArtifacts = data.artifacts;
    
    // Call the main game's startNewRound but override with server data
    // You'll need to modify the main game.js to accept this
}

function revealArtifactRemote(spotIndex, playerName) {
    // Another player dug up an artifact
    // Trigger the dig animation for that spot
    showNotification(`${playerName} found an artifact!`);
}

function showNotification(message) {
    const notif = document.createElement('div');
    notif.className = 'game-notification';
    notif.textContent = message;
    notif.style.cssText = `
        position: fixed;
        top: 100px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 15px 30px;
        border-radius: 10px;
        z-index: 999;
        animation: fadeInOut 2s forwards;
    `;
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 2000);
}

function showRoundResults(correctAnswer, leaderboard) {
    const overlay = document.createElement('div');
    overlay.className = 'results-overlay';
    overlay.innerHTML = `
        <div class="results-panel">
            <h2>Round Over!</h2>
            <p>The answer was: <strong>${correctAnswer}</strong></p>
            <h3>Leaderboard</h3>
            <div class="leaderboard">
                ${leaderboard.map((p, i) => `
                    <div class="leaderboard-item">
                        <span class="rank">#${i + 1}</span>
                        <span class="name">${p.name}</span>
                        <span class="score">${p.score}</span>
                    </div>
                `).join('')}
            </div>
            <p class="next-round-text">Next round starting soon...</p>
        </div>
    `;
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    `;
    document.body.appendChild(overlay);
    
    setTimeout(() => overlay.remove(), 4500);
}

function showGameOver(leaderboard) {
    const overlay = document.createElement('div');
    overlay.className = 'gameover-overlay';
    
    const winner = leaderboard[0];
    
    overlay.innerHTML = `
        <div class="gameover-panel">
            <h1>🏆 Game Over! 🏆</h1>
            <h2>${winner.name} wins!</h2>
            <div class="final-leaderboard">
                ${leaderboard.map((p, i) => `
                    <div class="leaderboard-item ${i === 0 ? 'winner' : ''}">
                        <span class="medal">${['🥇', '🥈', '🥉'][i] || ''}</span>
                        <span class="name">${p.name}</span>
                        <span class="score">${p.score} pts</span>
                    </div>
                `).join('')}
            </div>
            <button class="primary-btn" onclick="location.reload()">Play Again</button>
        </div>
    `;
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.9);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    `;
    document.body.appendChild(overlay);
}

function updateScoreboard() {
    // Update the in-game scoreboard
    // This syncs with server state
}

// Export for integration
export { socket, roomCode };
