// ============================================
// UNEARTH MULTIPLAYER SERVER
// ============================================

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(__dirname));
app.use('/public', express.static(join(__dirname, 'public')));

// ============================================
// DATA STRUCTURES
// ============================================

const lobbies = new Map();        // lobbyCode -> Lobby
const players = new Map();        // odlayerId -> Player
const connections = new Map();    // odlayerId -> WebSocket

// Countries available in the game
const COUNTRIES = ['Egypt', 'Greece', 'China', 'Mexico', 'Japan'];

app.get('/met-img/*', async (req, res) => {
    try {
        const remoteUrl = 'https://images.metmuseum.org' + req.path.replace('/met-img', '');

        const response = await fetch(remoteUrl);
        if (!response.ok) {
            return res.status(response.status).send('Failed to fetch image');
        }

        res.setHeader('Content-Type', response.headers.get('content-type') || 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400');

        const nodeStream = Readable.fromWeb(response.body);
        await pipeline(nodeStream, res);
    } catch (err) {
        console.error('[met-img proxy] Error:', err);
        res.status(500).send('Proxy error');
    }
});


// ============================================
// UTILITY FUNCTIONS
// ============================================

function generateId() {
    return Math.random().toString(36).substring(2, 15);
}

function generateLobbyCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Make sure code is unique
    if (lobbies.has(code)) {
        return generateLobbyCode();
    }
    return code;
}

function broadcast(lobby, message, excludeId = null) {
    lobby.players.forEach(player => {
        if (player.id !== excludeId) {
            const ws = connections.get(player.id);
            if (ws && ws.readyState === 1) {
                ws.send(JSON.stringify(message));
            }
        }
    });
}

function sendTo(playerId, message) {
    const ws = connections.get(playerId);
    if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify(message));
    }
}

function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// ============================================
// LOBBY CLASS
// ============================================

class Lobby {
    constructor(hostId, hostName, settings) {
        this.code = generateLobbyCode();
        this.name = settings.lobbyName || `${hostName}'s Lobby`;
        this.hostId = hostId;
        this.settings = {
            maxPlayers: settings.maxPlayers || 6,
            rounds: settings.rounds || 10,
            timePerRound: settings.timePerRound || 120,
            isPrivate: settings.isPrivate || false,
            password: settings.password || null
        };
        this.players = [];
        this.bannedIds = new Set();
        this.gameState = null;
        this.roundTimer = null;
    }

    addPlayer(player) {
        if (this.players.length >= this.settings.maxPlayers) {
            return { success: false, error: 'Lobby is full' };
        }
        if (this.bannedIds.has(player.id)) {
            return { success: false, error: 'You are banned from this lobby' };
        }
        this.players.push(player);
        return { success: true };
    }

    removePlayer(playerId) {
        this.players = this.players.filter(p => p.id !== playerId);
        
        // If host left, assign new host
        if (playerId === this.hostId && this.players.length > 0) {
            this.hostId = this.players[0].id;
            return { newHostId: this.hostId };
        }
        return {};
    }

    kickPlayer(playerId) {
        this.players = this.players.filter(p => p.id !== playerId);
    }

    banPlayer(playerId) {
        this.kickPlayer(playerId);
        this.bannedIds.add(playerId);
    }

    toPublicInfo() {
        return {
            code: this.code,
            name: this.name,
            playerCount: this.players.length,
            maxPlayers: this.settings.maxPlayers,
            rounds: this.settings.rounds,
            hasPassword: !!this.settings.password
        };
    }

    toFullInfo() {
        return {
            code: this.code,
            name: this.name,
            hostId: this.hostId,
            settings: {
                maxPlayers: this.settings.maxPlayers,
                rounds: this.settings.rounds,
                timePerRound: this.settings.timePerRound
            },
            players: this.players.map(p => ({
                id: p.id,
                name: p.name,
                score: p.score || 0
            }))
        };
    }

    // ============================================
    // GAME LOGIC
    // ============================================

    startGame() {
        // Generate round order (random countries)
        const countryPool = [];
        while (countryPool.length < this.settings.rounds) {
            countryPool.push(...shuffleArray(COUNTRIES));
        }
        
        this.gameState = {
            currentRound: 0,
            totalRounds: this.settings.rounds,
            countries: countryPool.slice(0, this.settings.rounds),
            scores: {},
            roundGuesses: {},
            roundStartTime: null,
            isRoundActive: false
        };

        // Initialize scores
        this.players.forEach(p => {
            this.gameState.scores[p.id] = 0;
            p.score = 0;
        });

        return this.gameState;
    }

    startRound() {
        const gs = this.gameState;
        gs.currentRound++;
        gs.roundGuesses = {};
        gs.roundStartTime = Date.now();
        gs.isRoundActive = true;

        const currentCountry = gs.countries[gs.currentRound - 1];

        // Start timer if time limit is set
        if (this.settings.timePerRound > 0) {
            this.roundTimer = setTimeout(() => {
                this.endRound();
            }, this.settings.timePerRound * 1000);
        }

        return {
            round: gs.currentRound,
            totalRounds: gs.totalRounds,
            country: currentCountry,
            timeLimit: this.settings.timePerRound
        };
    }

    submitGuess(playerId, guess) {
        const gs = this.gameState;
        if (!gs || !gs.isRoundActive) return null;
        if (gs.roundGuesses[playerId]) return null; // Already guessed

        const currentCountry = gs.countries[gs.currentRound - 1];
        const isCorrect = guess.toLowerCase() === currentCountry.toLowerCase();
        
        // Calculate points based on artifacts found (sent from client)
        // For now, use time-based scoring
        const timeElapsed = (Date.now() - gs.roundStartTime) / 1000;
        const timeBonus = Math.max(0, 500 - Math.floor(timeElapsed * 5));
        const points = isCorrect ? (300 + timeBonus) : -100;

        gs.roundGuesses[playerId] = {
            guess,
            isCorrect,
            points,
            time: timeElapsed
        };

        if (isCorrect) {
            gs.scores[playerId] = (gs.scores[playerId] || 0) + points;
            const player = this.players.find(p => p.id === playerId);
            if (player) player.score = gs.scores[playerId];
        }

        // Check if all players have guessed
        const allGuessed = this.players.every(p => gs.roundGuesses[p.id]);
        if (allGuessed) {
            this.endRound();
        }

        return {
            playerId,
            playerName: this.players.find(p => p.id === playerId)?.name,
            isCorrect,
            points: isCorrect ? points : 0,
            allGuessed
        };
    }

    endRound() {
        const gs = this.gameState;
        if (!gs || !gs.isRoundActive) return null;

        gs.isRoundActive = false;
        
        if (this.roundTimer) {
            clearTimeout(this.roundTimer);
            this.roundTimer = null;
        }

        const currentCountry = gs.countries[gs.currentRound - 1];
        const results = {
            round: gs.currentRound,
            correctAnswer: currentCountry,
            guesses: gs.roundGuesses,
            scores: gs.scores,
            isGameOver: gs.currentRound >= gs.totalRounds
        };

        // Broadcast round end
        broadcast(this, {
            type: 'round_end',
            ...results,
            standings: this.getStandings()
        });

        if (results.isGameOver) {
            this.endGame();
        }

        return results;
    }

    endGame() {
        const standings = this.getStandings();
        
        broadcast(this, {
            type: 'game_end',
            standings,
            winner: standings[0]
        });

        // Reset game state
        this.gameState = null;
    }

    getStandings() {
        return this.players
            .map(p => ({
                id: p.id,
                name: p.name,
                score: this.gameState?.scores[p.id] || 0
            }))
            .sort((a, b) => b.score - a.score);
    }

    getTimeRemaining() {
        if (!this.gameState || !this.gameState.roundStartTime) return 0;
        if (this.settings.timePerRound === 0) return -1; // No limit
        
        const elapsed = (Date.now() - this.gameState.roundStartTime) / 1000;
        return Math.max(0, this.settings.timePerRound - elapsed);
    }
}

// ============================================
// WEBSOCKET HANDLERS
// ============================================

wss.on('connection', (ws) => {
    const playerId = generateId();
    
    const player = {
        id: playerId,
        name: null,
        lobbyCode: null,
        score: 0
    };
    
    players.set(playerId, player);
    connections.set(playerId, ws);
    
    console.log(`[Server] Player connected: ${playerId}`);
    
    ws.send(JSON.stringify({
        type: 'connected',
        playerId
    }));

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            handleMessage(playerId, message);
        } catch (error) {
            console.error('[Server] Error parsing message:', error);
        }
    });

    ws.on('close', () => {
        handleDisconnect(playerId);
    });
});

function handleMessage(playerId, message) {
    const player = players.get(playerId);
    if (!player) return;

    console.log(`[Server] Message from ${playerId}:`, message.type);

    switch (message.type) {
        case 'create_lobby':
            handleCreateLobby(playerId, message);
            break;

        case 'join_lobby':
            handleJoinLobby(playerId, message);
            break;

        case 'leave_lobby':
            handleLeaveLobby(playerId);
            break;

        case 'kick_player':
            handleKickPlayer(playerId, message);
            break;

        case 'ban_player':
            handleBanPlayer(playerId, message);
            break;

        case 'get_lobbies':
            handleGetLobbies(playerId);
            break;

        case 'start_game':
            handleStartGame(playerId);
            break;

        case 'submit_guess':
            handleSubmitGuess(playerId, message);
            break;

        case 'request_next_round':
            handleNextRound(playerId);
            break;
    }
}

function handleCreateLobby(playerId, message) {
    const player = players.get(playerId);
    player.name = message.hostName;

    const lobby = new Lobby(playerId, message.hostName, {
        lobbyName: message.lobbyName,
        maxPlayers: message.maxPlayers,
        rounds: message.rounds,
        timePerRound: message.timePerRound,
        isPrivate: message.isPrivate,
        password: message.password
    });

    lobby.addPlayer(player);
    player.lobbyCode = lobby.code;
    
    lobbies.set(lobby.code, lobby);

    console.log(`[Server] Lobby created: ${lobby.code} by ${player.name}`);

    sendTo(playerId, {
        type: 'lobby_created',
        lobby: lobby.toFullInfo()
    });
}

function handleJoinLobby(playerId, message) {
    const player = players.get(playerId);
    const lobby = lobbies.get(message.lobbyCode.toUpperCase());

    if (!lobby) {
        sendTo(playerId, { type: 'error', message: 'Lobby not found' });
        return;
    }

    if (lobby.settings.password && lobby.settings.password !== message.password) {
        sendTo(playerId, { type: 'error', message: 'Incorrect password' });
        return;
    }

    if (lobby.gameState) {
        sendTo(playerId, { type: 'error', message: 'Game already in progress' });
        return;
    }

    player.name = message.playerName;
    const result = lobby.addPlayer(player);

    if (!result.success) {
        sendTo(playerId, { type: 'error', message: result.error });
        return;
    }

    player.lobbyCode = lobby.code;

    console.log(`[Server] ${player.name} joined lobby ${lobby.code}`);

    // Notify the joining player
    sendTo(playerId, {
        type: 'lobby_joined',
        lobby: lobby.toFullInfo()
    });

    // Notify others in lobby
    broadcast(lobby, {
        type: 'player_joined',
        player: { id: player.id, name: player.name },
        players: lobby.players.map(p => ({ id: p.id, name: p.name }))
    }, playerId);
}

function handleLeaveLobby(playerId) {
    const player = players.get(playerId);
    if (!player || !player.lobbyCode) return;

    const lobby = lobbies.get(player.lobbyCode);
    if (!lobby) return;

    const result = lobby.removePlayer(playerId);
    player.lobbyCode = null;

    console.log(`[Server] ${player.name} left lobby ${lobby.code}`);

    if (lobby.players.length === 0) {
        // Delete empty lobby
        lobbies.delete(lobby.code);
        console.log(`[Server] Lobby ${lobby.code} deleted (empty)`);
    } else {
        // Notify remaining players
        broadcast(lobby, {
            type: 'player_left',
            playerId,
            players: lobby.players.map(p => ({ id: p.id, name: p.name }))
        });

        if (result.newHostId) {
            broadcast(lobby, {
                type: 'host_changed',
                newHostId: result.newHostId
            });
        }
    }
}

function handleKickPlayer(playerId, message) {
    const player = players.get(playerId);
    if (!player || !player.lobbyCode) return;

    const lobby = lobbies.get(player.lobbyCode);
    if (!lobby || lobby.hostId !== playerId) return;

    const targetPlayer = players.get(message.targetId);
    if (!targetPlayer) return;

    lobby.kickPlayer(message.targetId);
    targetPlayer.lobbyCode = null;

    console.log(`[Server] ${targetPlayer.name} was kicked from ${lobby.code}`);

    sendTo(message.targetId, {
        type: 'player_kicked',
        playerId: message.targetId
    });

    broadcast(lobby, {
        type: 'player_kicked',
        playerId: message.targetId,
        players: lobby.players.map(p => ({ id: p.id, name: p.name }))
    });
}

function handleBanPlayer(playerId, message) {
    const player = players.get(playerId);
    if (!player || !player.lobbyCode) return;

    const lobby = lobbies.get(player.lobbyCode);
    if (!lobby || lobby.hostId !== playerId) return;

    const targetPlayer = players.get(message.targetId);
    if (!targetPlayer) return;

    lobby.banPlayer(message.targetId);
    targetPlayer.lobbyCode = null;

    console.log(`[Server] ${targetPlayer.name} was banned from ${lobby.code}`);

    sendTo(message.targetId, {
        type: 'player_kicked',
        playerId: message.targetId,
        banned: true
    });

    broadcast(lobby, {
        type: 'player_kicked',
        playerId: message.targetId,
        players: lobby.players.map(p => ({ id: p.id, name: p.name }))
    });
}

function handleGetLobbies(playerId) {
    const publicLobbies = [];
    
    lobbies.forEach(lobby => {
        if (!lobby.settings.isPrivate && !lobby.gameState) {
            publicLobbies.push(lobby.toPublicInfo());
        }
    });

    sendTo(playerId, {
        type: 'lobby_list',
        lobbies: publicLobbies
    });
}

function handleStartGame(playerId) {
    const player = players.get(playerId);
    if (!player || !player.lobbyCode) return;

    const lobby = lobbies.get(player.lobbyCode);
    if (!lobby || lobby.hostId !== playerId) return;

    console.log(`[Server] Starting game in lobby ${lobby.code}`);

    // Send countdown
    broadcast(lobby, {
        type: 'game_starting',
        countdown: 3
    });

    // Start game after countdown
    setTimeout(() => {
        lobby.startGame();
        
        broadcast(lobby, {
            type: 'game_started',
            settings: {
                rounds: lobby.settings.rounds,
                timePerRound: lobby.settings.timePerRound
            }
        });

        // Start first round after short delay
        setTimeout(() => {
            const roundInfo = lobby.startRound();
            broadcast(lobby, {
                type: 'round_start',
                ...roundInfo
            });

            // Start timer sync
            startTimerSync(lobby);
        }, 1000);
    }, 3000);
}

function handleSubmitGuess(playerId, message) {
    const player = players.get(playerId);
    if (!player || !player.lobbyCode) return;

    const lobby = lobbies.get(player.lobbyCode);
    if (!lobby || !lobby.gameState) return;

    const result = lobby.submitGuess(playerId, message.guess);
    if (!result) return;

    // Notify all players about the guess
    broadcast(lobby, {
        type: 'player_guessed',
        ...result
    });

    // Send score update (check gameState still exists after submitGuess)
    if (lobby.gameState) {
        broadcast(lobby, {
            type: 'score_update',
            scores: lobby.gameState.scores,
            standings: lobby.getStandings()
        });
    }
}

function handleNextRound(playerId) {
    const player = players.get(playerId);
    if (!player || !player.lobbyCode) return;

    const lobby = lobbies.get(player.lobbyCode);
    if (!lobby) return;

    // Allow any player to trigger next round (first one wins)
    if (lobby.gameState && !lobby.gameState.isRoundActive && !lobby.gameState.isGameOver) {
        const roundInfo = lobby.startRound();
        if (roundInfo) {
            broadcast(lobby, {
                type: 'round_start',
                ...roundInfo
            });
            startTimerSync(lobby);
        }
    }
}

function startTimerSync(lobby) {
    if (lobby.settings.timePerRound === 0) return;

    const syncInterval = setInterval(() => {
        if (!lobby.gameState || !lobby.gameState.isRoundActive) {
            clearInterval(syncInterval);
            return;
        }

        const timeRemaining = lobby.getTimeRemaining();
        broadcast(lobby, {
            type: 'timer_sync',
            timeRemaining: Math.ceil(timeRemaining)
        });

        if (timeRemaining <= 0) {
            clearInterval(syncInterval);
        }
    }, 1000);
}

function handleDisconnect(playerId) {
    const player = players.get(playerId);
    if (!player) return;

    console.log(`[Server] Player disconnected: ${playerId} (${player.name})`);

    // Handle leaving lobby
    if (player.lobbyCode) {
        handleLeaveLobby(playerId);
    }

    players.delete(playerId);
    connections.delete(playerId);
}

// ============================================
// START SERVER
// ============================================

server.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════╗
║         UNEARTH MULTIPLAYER SERVER        ║
╠═══════════════════════════════════════════╣
║  Server running on http://localhost:${PORT}  ║
║  WebSocket ready for connections          ║
╚═══════════════════════════════════════════╝
    `);
});