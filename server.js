// ============================================
// UNEARTH MULTIPLAYER SERVER
// ============================================

import 'dotenv/config';
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

// Admin panel route
app.get('/admin', (req, res) => {
    res.sendFile(join(__dirname, 'public', 'admin', 'index.html'));
});

// ============================================
// DATA STRUCTURES
// ============================================

const lobbies = new Map();        // lobbyCode -> Lobby
const players = new Map();        // odlayerId -> Player
const connections = new Map();    // odlayerId -> WebSocket
const adminConnections = new Set(); // WebSocket connections subscribed to admin logs

// ── Admin Config ──
const ADMIN_KEY = process.env.ADMIN_KEY || 'unearth-admin-2026';

// ── Ban System ──
import { readFileSync, writeFileSync, existsSync } from 'fs';

const BANS_FILE = join(__dirname, 'bans.json');
let bans = new Map(); // ip -> { reason, bannedAt, expiresAt (null=permanent), bannedName }

function loadBans() {
    try {
        if (existsSync(BANS_FILE)) {
            const data = JSON.parse(readFileSync(BANS_FILE, 'utf8'));
            bans = new Map(Object.entries(data));
            // Clean expired bans on load
            const now = Date.now();
            for (const [ip, ban] of bans) {
                if (ban.expiresAt && ban.expiresAt < now) bans.delete(ip);
            }
            saveBans();
            console.log(`[Bans] Loaded ${bans.size} active bans`);
        }
    } catch (e) {
        console.error('[Bans] Failed to load bans:', e.message);
    }
}

function saveBans() {
    try {
        writeFileSync(BANS_FILE, JSON.stringify(Object.fromEntries(bans), null, 2));
    } catch (e) {
        console.error('[Bans] Failed to save bans:', e.message);
    }
}

function isIPBanned(ip) {
    const ban = bans.get(ip);
    if (!ban) return null;
    // Check expiry
    if (ban.expiresAt && ban.expiresAt < Date.now()) {
        bans.delete(ip);
        saveBans();
        return null;
    }
    return ban;
}

function getClientIP(ws, req) {
    // Support proxies (Render, nginx, etc.)
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) return forwarded.split(',')[0].trim();
    return req.socket.remoteAddress || 'unknown';
}

loadBans();

// ── Rate Limiting ──
const rateLimits = new Map(); // ip -> { connections: timestamp[], messages: timestamp[] }

function getRateLimit(ip) {
    if (!rateLimits.has(ip)) {
        rateLimits.set(ip, { connections: [], messages: [], lobbyCreations: [] });
    }
    return rateLimits.get(ip);
}

function isRateLimited(ip, type, maxCount, windowMs) {
    const limits = getRateLimit(ip);
    const now = Date.now();
    // Clean old entries
    limits[type] = limits[type].filter(t => now - t < windowMs);
    if (limits[type].length >= maxCount) return true;
    limits[type].push(now);
    return false;
}

// Clean rate limit entries every 60 seconds
setInterval(() => {
    const now = Date.now();
    for (const [ip, limits] of rateLimits) {
        limits.connections = limits.connections.filter(t => now - t < 60000);
        limits.messages = limits.messages.filter(t => now - t < 10000);
        limits.lobbyCreations = limits.lobbyCreations.filter(t => now - t < 30000);
        if (limits.connections.length === 0 && limits.messages.length === 0) {
            rateLimits.delete(ip);
        }
    }
}, 60000);

// Rate limits config
const RATE_LIMITS = {
    connections: { max: 10, window: 60000 },    // 10 connections per minute per IP
    messages:    { max: 30, window: 10000 },     // 30 messages per 10 seconds per IP
    lobbies:     { max: 3,  window: 30000 },     // 3 lobby creations per 30 seconds per IP
    guesses:     { max: 10, window: 10000 },     // 10 guesses per 10 seconds per IP
};

// Simple API rate limiter middleware
function apiRateLimiter(req, res, next) {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = forwarded ? forwarded.split(',')[0].trim() : req.socket.remoteAddress || 'unknown';
    if (isRateLimited(ip, 'messages', 60, 60000)) { // 60 API calls per minute
        return res.status(429).json({ error: 'Too many requests' });
    }
    next();
}

app.use('/api', apiRateLimiter);

// ── Server Stats ──
const serverStats = {
    startedAt: Date.now(),
    totalConnections: 0,
    peakPlayers: 0,
    totalGamesPlayed: 0,
    totalGuesses: 0,
};

function adminLog(type, message) {
    const payload = JSON.stringify({ type: 'admin_log', logType: type, message });
    adminConnections.forEach(ws => {
        try { ws.send(payload); } catch (e) { /* dead connection */ }
    });
    console.log(`[${type.toUpperCase()}] ${message}`);
}

function checkAdminKey(req, res, next) {
    if (req.headers['x-admin-key'] !== ADMIN_KEY) {
        return res.status(403).json({ error: 'Invalid admin key' });
    }
    next();
}

// ── Admin API ──
app.use(express.json());

app.get('/api/admin/stats', checkAdminKey, (req, res) => {
    const lobbyList = [];
    lobbies.forEach((lobby, code) => {
        lobbyList.push({
            code,
            name: lobby.name,
            hostId: lobby.hostId,
            playerCount: lobby.players.length,
            players: lobby.players.map(p => ({ id: p.id, name: p.name, score: p.score })),
            settings: lobby.settings,
            gameState: lobby.gameState ? {
                inProgress: lobby.gameState.inProgress,
                gameOver: lobby.gameState.gameOver,
                currentRound: lobby.gameState.currentRound,
                currentCountry: lobby.gameState.currentCountry,
            } : null,
        });
    });

    const playerList = [];
    players.forEach((player, id) => {
        playerList.push({
            id,
            name: player.name,
            lobbyCode: player.lobbyCode,
            score: player.score,
            ip: player.ip,
        });
    });

    const inGameCount = lobbyList.filter(l => l.gameState?.inProgress).length;

    res.json({
        players: {
            online: players.size,
            peak: serverStats.peakPlayers,
            list: playerList,
        },
        lobbies: {
            total: lobbies.size,
            inGame: inGameCount,
            list: lobbyList,
        },
        stats: {
            totalGamesPlayed: serverStats.totalGamesPlayed,
            totalGuesses: serverStats.totalGuesses,
            totalConnections: serverStats.totalConnections,
            uptimeSeconds: Math.floor((Date.now() - serverStats.startedAt) / 1000),
            startedAt: new Date(serverStats.startedAt).toISOString(),
        }
    });
});

app.post('/api/admin/lobby/:code/close', checkAdminKey, (req, res) => {
    const lobby = lobbies.get(req.params.code);
    if (!lobby) return res.status(404).json({ error: 'Lobby not found' });

    // Notify all players
    lobby.players.forEach(p => {
        const ws = connections.get(p.id);
        if (ws) {
            ws.send(JSON.stringify({ type: 'lobby_closed', reason: 'Closed by admin' }));
        }
        const playerData = players.get(p.id);
        if (playerData) playerData.lobbyCode = null;
    });

    lobbies.delete(req.params.code);
    adminLog('admin', `Lobby ${req.params.code} closed by admin`);
    res.json({ success: true });
});

app.post('/api/admin/lobby/:code/kick/:playerId', checkAdminKey, (req, res) => {
    const lobby = lobbies.get(req.params.code);
    if (!lobby) return res.status(404).json({ error: 'Lobby not found' });

    const ws = connections.get(req.params.playerId);
    if (ws) {
        ws.send(JSON.stringify({ type: 'kicked', reason: 'Kicked by admin' }));
    }

    lobby.removePlayer(req.params.playerId);
    const playerData = players.get(req.params.playerId);
    if (playerData) playerData.lobbyCode = null;

    broadcast(lobby, { type: 'lobby_update', lobby: lobby.getState() });
    adminLog('admin', `Kicked player ${req.params.playerId} from lobby ${req.params.code}`);
    res.json({ success: true });
});

app.post('/api/admin/broadcast', checkAdminKey, (req, res) => {
    const msg = req.body.message;
    if (!msg) return res.status(400).json({ error: 'No message' });

    const payload = JSON.stringify({ type: 'server_message', message: msg });
    connections.forEach(ws => {
        try { ws.send(payload); } catch (e) { /* skip dead */ }
    });

    adminLog('admin', `Broadcast: "${msg}"`);
    res.json({ success: true, recipients: connections.size });
});

// Ban a player by their current connection (looks up IP)
app.post('/api/admin/ban/:playerId', checkAdminKey, (req, res) => {
    const player = players.get(req.params.playerId);
    if (!player) return res.status(404).json({ error: 'Player not found' });
    if (!player.ip || player.ip === 'unknown') return res.status(400).json({ error: 'Cannot determine player IP' });

    const { reason, duration } = req.body; // duration in hours, null = permanent
    const ban = {
        reason: reason || 'Banned by admin',
        bannedAt: Date.now(),
        expiresAt: duration ? Date.now() + (duration * 3600000) : null,
        bannedName: player.name || 'Unknown',
    };

    bans.set(player.ip, ban);
    saveBans();

    // Notify and disconnect the player
    const ws = connections.get(req.params.playerId);
    if (ws) {
        ws.send(JSON.stringify({
            type: 'banned',
            reason: ban.reason,
            expiresAt: ban.expiresAt,
        }));
        setTimeout(() => ws.close(), 500); // give time for message to send
    }

    // Remove from lobby
    if (player.lobbyCode) {
        const lobby = lobbies.get(player.lobbyCode);
        if (lobby) {
            lobby.removePlayer(req.params.playerId);
            broadcast(lobby, { type: 'lobby_update', lobby: lobby.getState() });
        }
    }

    const durationText = duration ? `${duration}h` : 'permanent';
    adminLog('admin', `BANNED ${player.name} (IP: ${player.ip}) — ${durationText}: ${ban.reason}`);
    res.json({ success: true, ip: player.ip, duration: durationText });
});

// Ban by IP directly
app.post('/api/admin/ban-ip', checkAdminKey, (req, res) => {
    const { ip, reason, duration } = req.body;
    if (!ip) return res.status(400).json({ error: 'No IP provided' });

    const ban = {
        reason: reason || 'Banned by admin',
        bannedAt: Date.now(),
        expiresAt: duration ? Date.now() + (duration * 3600000) : null,
        bannedName: 'Manual IP ban',
    };

    bans.set(ip, ban);
    saveBans();

    // Disconnect any currently connected players with this IP
    players.forEach((player, playerId) => {
        if (player.ip === ip) {
            const ws = connections.get(playerId);
            if (ws) {
                ws.send(JSON.stringify({ type: 'banned', reason: ban.reason, expiresAt: ban.expiresAt }));
                setTimeout(() => ws.close(), 500);
            }
        }
    });

    const durationText = duration ? `${duration}h` : 'permanent';
    adminLog('admin', `IP BANNED ${ip} — ${durationText}: ${ban.reason}`);
    res.json({ success: true });
});

// Unban an IP
app.post('/api/admin/unban/:ip', checkAdminKey, (req, res) => {
    const ip = decodeURIComponent(req.params.ip);
    if (!bans.has(ip)) return res.status(404).json({ error: 'IP not banned' });

    bans.delete(ip);
    saveBans();
    adminLog('admin', `Unbanned IP: ${ip}`);
    res.json({ success: true });
});

// Get all bans
app.get('/api/admin/bans', checkAdminKey, (req, res) => {
    const banList = [];
    const now = Date.now();
    bans.forEach((ban, ip) => {
        // Clean expired while listing
        if (ban.expiresAt && ban.expiresAt < now) {
            bans.delete(ip);
            return;
        }
        banList.push({ ip, ...ban });
    });
    saveBans();
    res.json({ bans: banList });
});

// Countries available in the game
const COUNTRIES = [
    'Egypt', 'Greece', 'China', 'Mexico', 'Japan', 'Italy', 'India', 'Peru', 'Iraq',
    'France', 'United Kingdom', 'Spain', 'Germany', 'Netherlands', 'Ireland', 'Russia',
    'Turkey', 'Iran', 'Morocco',
    'South Korea', 'Thailand', 'Cambodia', 'Indonesia',
    'Nigeria', 'Ethiopia',
    'Colombia', 'Brazil', 'United States',
    'Australia',
    'Norway', 'Sweden', 'Denmark'
];

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
                score: p.score || 0,
                color: p.color || '#ffd700'
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
            isRoundActive: false,
            isRoundPending: false,  // True between startRound() and activateRound()
            isGameOver: false
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
        gs.readyPlayers = new Set();
        gs.isRoundActive = false;
        gs.isRoundPending = true;   // Prevents duplicate startRound calls

        const currentCountry = gs.countries[gs.currentRound - 1];

        // Safety timeout: if not all players ready in 15s, start anyway
        this.readyTimeout = setTimeout(() => {
            if (!gs.isRoundActive && gs.isRoundPending) {
                console.log(`[Server] Ready timeout - starting round ${gs.currentRound} with ${gs.readyPlayers.size}/${this.players.length} ready`);
                this.activateRound();
                broadcast(this, {
                    type: 'round_go',
                    serverTime: Date.now(),
                    roundStartTime: gs.roundStartTime,
                    timePerRound: this.settings.timePerRound,
                    timeRemaining: this.settings.timePerRound
                });
                startTimerSync(this);
            }
        }, 15000);

        return {
            round: gs.currentRound,
            totalRounds: gs.totalRounds,
            country: currentCountry,
            timeLimit: this.settings.timePerRound
        };
    }

    // Called when a player finishes loading
    playerReady(playerId) {
        const gs = this.gameState;
        if (!gs || gs.isRoundActive) return false;

        gs.readyPlayers.add(playerId);

        // Check if all players are ready
        const allReady = this.players.every(p => gs.readyPlayers.has(p.id));
        return allReady;
    }

    // Called when all players are ready - actually start the timer
    activateRound() {
        const gs = this.gameState;
        if (!gs || gs.isRoundActive) return;

        gs.roundStartTime = Date.now();
        gs.isRoundActive = true;
        gs.isRoundPending = false;

        // Start timeout timer if time limit is set
        if (this.settings.timePerRound > 0) {
            this.roundTimer = setTimeout(() => {
                this.endRound();
            }, this.settings.timePerRound * 1000);
        }
    }

    submitGuess(playerId, guess, artifactsFound = 0) {
        const gs = this.gameState;
        if (!gs || !gs.isRoundActive) return null;
        if (gs.roundGuesses[playerId]) return null; // Already guessed

        const currentCountry = gs.countries[gs.currentRound - 1];
        const isCorrect = guess.toLowerCase() === currentCountry.toLowerCase();

        // Use same scoring as client: artifact-based + time bonus
        let basePoints;
        if (artifactsFound <= 1) basePoints = 500;
        else if (artifactsFound === 2) basePoints = 400;
        else if (artifactsFound === 3) basePoints = 300;
        else if (artifactsFound === 4) basePoints = 200;
        else basePoints = 100;

        const timeElapsed = (Date.now() - gs.roundStartTime) / 1000;
        const timeBonus = Math.floor(Math.max(0, this.settings.timePerRound - timeElapsed));
        const points = isCorrect ? (basePoints + timeBonus) : -100;

        gs.roundGuesses[playerId] = {
            guess,
            isCorrect,
            points,
            time: timeElapsed
        };

        if (isCorrect) {
            gs.scores[playerId] = (gs.scores[playerId] || 0) + points;
        } else {
            gs.scores[playerId] = Math.max(0, (gs.scores[playerId] || 0) + points);
        }
        const player = this.players.find(p => p.id === playerId);
        if (player) player.score = gs.scores[playerId];

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
        gs.isRoundPending = false;
        gs.isGameOver = gs.currentRound >= gs.totalRounds;

        if (this.roundTimer) {
            clearTimeout(this.roundTimer);
            this.roundTimer = null;
        }
        if (this.readyTimeout) {
            clearTimeout(this.readyTimeout);
            this.readyTimeout = null;
        }

        const currentCountry = gs.countries[gs.currentRound - 1];

        // Build per-player results with colors
        const playerResults = this.players.map(p => {
            const guess = gs.roundGuesses[p.id];
            return {
                playerId: p.id,
                playerName: p.name,
                color: p.color || '#ffd700',
                isCorrect: guess?.isCorrect || false,
                isTimeout: !guess,
                points: guess?.points || 0,
                guess: guess?.guess || null,
            };
        });

        const results = {
            round: gs.currentRound,
            correctAnswer: currentCountry,
            guesses: gs.roundGuesses,
            results: playerResults,
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
        const gs = this.gameState;

        // Send personalized game_end to each player with their stats
        this.players.forEach(p => {
            const ws = connections.get(p.id);
            if (ws && ws.readyState === 1) {
                // Count correct guesses for this player
                let correctCount = 0;
                let totalGuesses = 0;
                for (let round = 0; round < (gs?.totalRounds || 0); round++) {
                    // We don't have per-round history easily, so use score as proxy
                }

                ws.send(JSON.stringify({
                    type: 'game_end',
                    standings,
                    winner: standings[0],
                    yourScore: gs?.scores[p.id] || 0,
                    totalRounds: gs?.totalRounds || 0,
                }));
            }
        });

        // Reset game state
        this.gameState = null;
    }

    getStandings() {
        return this.players
            .map(p => ({
                id: p.id,
                name: p.name,
                score: this.gameState?.scores[p.id] || 0,
                color: p.color || '#ffd700'
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

wss.on('connection', (ws, req) => {
    const clientIP = getClientIP(ws, req);

    // Check if IP is banned
    const ban = isIPBanned(clientIP);
    if (ban) {
        ws.send(JSON.stringify({
            type: 'banned',
            reason: ban.reason || 'You have been banned from this server.',
            expiresAt: ban.expiresAt || null,
        }));
        ws.close();
        adminLog('connect', `Banned IP ${clientIP} attempted to connect`);
        return;
    }

    // Connection rate limit
    if (isRateLimited(clientIP, 'connections', RATE_LIMITS.connections.max, RATE_LIMITS.connections.window)) {
        ws.send(JSON.stringify({ type: 'error', message: 'Too many connections. Please wait.' }));
        ws.close();
        adminLog('connect', `Rate limited connection from ${clientIP}`);
        return;
    }

    const playerId = generateId();

    const player = {
        id: playerId,
        name: null,
        lobbyCode: null,
        score: 0,
        isAdmin: false,
        ip: clientIP,
        color: '#ffd700',
    };

    players.set(playerId, player);
    connections.set(playerId, ws);

    // Track stats
    serverStats.totalConnections++;
    if (players.size > serverStats.peakPlayers) {
        serverStats.peakPlayers = players.size;
    }

    adminLog('connect', `Player connected: ${playerId} (${players.size} online)`);

    ws.send(JSON.stringify({
        type: 'connected',
        playerId
    }));

    ws.on('message', (data) => {
        try {
            // Message rate limit
            if (isRateLimited(clientIP, 'messages', RATE_LIMITS.messages.max, RATE_LIMITS.messages.window)) {
                ws.send(JSON.stringify({ type: 'error', message: 'Slow down! Too many messages.' }));
                return;
            }

            const message = JSON.parse(data);

            // Handle admin subscription
            if (message.type === 'admin_subscribe') {
                if (message.key === ADMIN_KEY) {
                    adminConnections.add(ws);
                    player.isAdmin = true;
                    ws.send(JSON.stringify({ type: 'admin_subscribed' }));
                }
                return;
            }

            handleMessage(playerId, message);
        } catch (error) {
            console.error('[Server] Error parsing message:', error);
        }
    });

    ws.on('close', () => {
        adminConnections.delete(ws);
        handleDisconnect(playerId);
    });
});

function handleMessage(playerId, message) {
    const player = players.get(playerId);
    if (!player) return;

    console.log(`[Server] Message from ${playerId}:`, message.type);

    switch (message.type) {
        case 'create_lobby':
            if (isRateLimited(player.ip, 'lobbyCreations', RATE_LIMITS.lobbies.max, RATE_LIMITS.lobbies.window)) {
                sendToPlayer(playerId, { type: 'error', message: 'Please wait before creating another lobby.' });
                return;
            }
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

        case 'player_ready':
            handlePlayerReady(playerId);
            break;
    }
}

function handleCreateLobby(playerId, message) {
    const player = players.get(playerId);
    player.name = message.hostName;
    player.color = message.color || '#ffd700';

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
    adminLog('lobby', `Lobby "${lobby.name}" (${lobby.code}) created by ${player.name}`);

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
    player.color = message.color || '#ffd700';
    const result = lobby.addPlayer(player);

    if (!result.success) {
        sendTo(playerId, { type: 'error', message: result.error });
        return;
    }

    player.lobbyCode = lobby.code;

    console.log(`[Server] ${player.name} joined lobby ${lobby.code}`);
    adminLog('lobby', `${player.name} joined lobby ${lobby.code}`);

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
    adminLog('lobby', `${player.name} left lobby ${lobby.code}`);

    if (lobby.players.length === 0) {
        // Delete empty lobby
        lobbies.delete(lobby.code);
        console.log(`[Server] Lobby ${lobby.code} deleted (empty)`);
        adminLog('lobby', `Lobby ${lobby.code} deleted (empty)`);
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

        // If we're waiting for ready and the disconnected player was the holdout, check
        const gs = lobby.gameState;
        if (gs && gs.readyPlayers && !gs.isRoundActive) {
            gs.readyPlayers.delete(playerId);
            const allReady = lobby.players.every(p => gs.readyPlayers.has(p.id));
            if (allReady && lobby.players.length > 0) {
                if (lobby.readyTimeout) {
                    clearTimeout(lobby.readyTimeout);
                    lobby.readyTimeout = null;
                }
                lobby.activateRound();
                broadcast(lobby, {
                    type: 'round_go',
                    serverTime: Date.now(),
                    roundStartTime: gs.roundStartTime,
                    timePerRound: lobby.settings.timePerRound,
                    timeRemaining: lobby.settings.timePerRound
                });
                startTimerSync(lobby);
            }
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
    adminLog('lobby', `${targetPlayer.name} was kicked from ${lobby.code}`);

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
    adminLog('lobby', `${targetPlayer.name} was BANNED from ${lobby.code}`);

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
    adminLog('game', `Game started in lobby ${lobby.code} (${lobby.players.length} players)`);
    serverStats.totalGamesPlayed++;

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
            // Timer will start when all players send player_ready
        }, 1000);
    }, 3000);
}

function handleSubmitGuess(playerId, message) {
    const player = players.get(playerId);
    if (!player || !player.lobbyCode) return;

    const lobby = lobbies.get(player.lobbyCode);
    if (!lobby || !lobby.gameState) return;

    const result = lobby.submitGuess(playerId, message.guess, message.artifactsFound || 0);
    if (!result) return;

    serverStats.totalGuesses++;
    adminLog('game', `${player.name} guessed "${message.guess}" in ${lobby.code} — ${result.correct ? '✓ CORRECT' : '✗ wrong'}`);

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

    // Allow any player to trigger next round (first one wins, second is ignored)
    if (lobby.gameState && !lobby.gameState.isRoundActive && !lobby.gameState.isRoundPending && !lobby.gameState.isGameOver) {
        const roundInfo = lobby.startRound();
        if (roundInfo) {
            broadcast(lobby, {
                type: 'round_start',
                ...roundInfo
            });
            // DON'T start timer yet - wait for player_ready from all
        }
    }
}

function handlePlayerReady(playerId) {
    const player = players.get(playerId);
    if (!player || !player.lobbyCode) return;

    const lobby = lobbies.get(player.lobbyCode);
    if (!lobby || !lobby.gameState) return;

    const allReady = lobby.playerReady(playerId);
    adminLog('game', `Player ${player.name} ready for round ${lobby.gameState.currentRound} (${lobby.gameState.readyPlayers.size}/${lobby.players.length})`);

    if (allReady) {
        // Clear safety timeout
        if (lobby.readyTimeout) {
            clearTimeout(lobby.readyTimeout);
            lobby.readyTimeout = null;
        }

        // All players loaded - NOW start the round timer
        lobby.activateRound();

        broadcast(lobby, {
            type: 'round_go',
            serverTime: Date.now(),
            roundStartTime: lobby.gameState.roundStartTime,
            timePerRound: lobby.settings.timePerRound,
            timeRemaining: lobby.settings.timePerRound
        });

        // Start periodic timer sync
        startTimerSync(lobby);
    }
}

function startTimerSync(lobby) {
    if (lobby.settings.timePerRound === 0) return;

    // Send authoritative time reference at start
    broadcast(lobby, {
        type: 'timer_sync',
        serverTime: Date.now(),
        roundStartTime: lobby.gameState.roundStartTime,
        timePerRound: lobby.settings.timePerRound,
        timeRemaining: Math.floor(lobby.getTimeRemaining())
    });

    // Periodic drift correction every 5 seconds (not every 1s)
    const syncInterval = setInterval(() => {
        if (!lobby.gameState || !lobby.gameState.isRoundActive) {
            clearInterval(syncInterval);
            return;
        }

        const timeRemaining = lobby.getTimeRemaining();
        broadcast(lobby, {
            type: 'timer_sync',
            serverTime: Date.now(),
            roundStartTime: lobby.gameState.roundStartTime,
            timePerRound: lobby.settings.timePerRound,
            timeRemaining: Math.floor(timeRemaining)
        });

        if (timeRemaining <= 0) {
            clearInterval(syncInterval);
        }
    }, 5000);
}

function handleDisconnect(playerId) {
    const player = players.get(playerId);
    if (!player) return;

    console.log(`[Server] Player disconnected: ${playerId} (${player.name})`);
    adminLog('disconnect', `${player.name || 'Unknown'} disconnected (${players.size} online)`);

    // Handle leaving lobby
    if (player.lobbyCode) {
        handleLeaveLobby(playerId);
    }

    players.delete(playerId);
    connections.delete(playerId);
}

// ============================================
// LEADERBOARD SYSTEM
// ============================================

const LEADERBOARD_FILE = 'leaderboard.json';
let leaderboard = [];

function loadLeaderboard() {
    try {
        if (existsSync(LEADERBOARD_FILE)) {
            leaderboard = JSON.parse(readFileSync(LEADERBOARD_FILE, 'utf8'));
            console.log(`[Leaderboard] Loaded ${leaderboard.length} entries`);
        }
    } catch (e) {
        console.warn('[Leaderboard] Failed to load:', e.message);
        leaderboard = [];
    }
}

function saveLeaderboard() {
    try {
        writeFileSync(LEADERBOARD_FILE, JSON.stringify(leaderboard, null, 2));
    } catch (e) {
        console.warn('[Leaderboard] Failed to save:', e.message);
    }
}

loadLeaderboard();

// GET leaderboard
app.get('/api/leaderboard', (req, res) => {
    res.json(leaderboard.slice(0, 50));
});

// POST score to leaderboard
app.post('/api/leaderboard', express.json(), (req, res) => {
    const { name, score, rounds, correct, accuracy, color } = req.body;

    if (!name || typeof score !== 'number' || score < 0) {
        return res.status(400).json({ error: 'Invalid score data' });
    }

    const entry = {
        name: String(name).slice(0, 20),
        score: Math.round(score),
        rounds: rounds || 0,
        correct: correct || 0,
        accuracy: accuracy || 0,
        color: color || '#ffd700',
        date: new Date().toISOString(),
    };

    leaderboard.push(entry);
    leaderboard.sort((a, b) => b.score - a.score);
    leaderboard = leaderboard.slice(0, 100); // Keep top 100
    saveLeaderboard();

    const rank = leaderboard.findIndex(e => e === entry) + 1;
    res.json({ success: true, rank, total: leaderboard.length });
});

// ============================================
// START SERVER
// ============================================

server.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════╗
║         UNEARTH MULTIPLAYER SERVER        ║
╠═══════════════════════════════════════════╣
║  Server:  http://localhost:${PORT}          ║
║  Admin:   http://localhost:${PORT}/admin     ║
║  Key:     ${ADMIN_KEY.substring(0, 20).padEnd(20)}       ║
║  WebSocket ready for connections          ║
╚═══════════════════════════════════════════╝
    `);
});