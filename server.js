// ============================================
// UNEARTH SERVER — static hosting, multiplayer lobbies, leaderboard, admin API
// ============================================

import 'dotenv/config';
import express from 'express';
import compression from 'compression';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync, existsSync, renameSync } from 'fs';
import { timingSafeEqual, randomBytes } from 'crypto';

import { SITE_NAMES, resolveCountry } from './client/js/shared/countries.js';
import {
    VERSION, ROUND_OPTIONS, TIME_OPTIONS, MAX_PLAYER_OPTIONS, WRONG_GUESS_PENALTY,
    pointsForCorrect, maxPointsPerRound, clampToOption,
} from './client/js/shared/rules.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLIENT_DIR = join(__dirname, 'client');
const PUBLIC_DIR = join(__dirname, 'public');
const PORT = process.env.PORT || 3000;
const PUBLIC_URL = (process.env.PUBLIC_URL || 'https://www.playunearth.tech').replace(/\/+$/, '');

// Sites allowed to call the API from a browser when the game is hosted elsewhere
// (e.g. the static build on Vercel). Comma-separated origins; "*" wildcards allowed,
// as in "https://*.vercel.app". The public site and its www / bare variant are always allowed.
const ALLOWED_ORIGINS = allowedOrigins(process.env.ALLOWED_ORIGINS, PUBLIC_URL);

function allowedOrigins(list, publicUrl) {
    const out = new Set(String(list || '').split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean));
    try {
        const u = new URL(publicUrl);
        out.add(u.origin);
        const host = u.hostname.startsWith('www.') ? u.hostname.slice(4) : `www.${u.hostname}`;
        out.add(`${u.protocol}//${host}${u.port ? `:${u.port}` : ''}`);
    } catch { /* PUBLIC_URL is not a URL: only the explicit list applies */ }
    return [...out].map(p => p === '*' ? /^.*$/ : new RegExp(`^${p.split('*').map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')}$`, 'i'));
}

function isAllowedOrigin(origin) {
    return !!origin && ALLOWED_ORIGINS.some(re => re.test(origin));
}

const ROUND_BREAK_MS = 7000;   // results screen between multiplayer rounds
const READY_TIMEOUT_MS = 15000; // start a round even if a client is slow to load

// ── Admin key ──
const ADMIN_KEY = process.env.ADMIN_KEY || 'unearth-admin-2026';
if (!process.env.ADMIN_KEY) {
    console.warn('[Security] ADMIN_KEY is not set — using the built-in default. Set ADMIN_KEY in your environment to secure /admin.');
}

function isAdminKey(candidate) {
    if (typeof candidate !== 'string') return false;
    const a = Buffer.from(candidate);
    const b = Buffer.from(ADMIN_KEY);
    return a.length === b.length && timingSafeEqual(a, b);
}

// ============================================
// INPUT HELPERS
// ============================================

function cleanText(value, max) {
    return String(value ?? '')
        .replace(/[\u0000-\u001f\u007f<>]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, max);
}

function cleanColor(value) {
    return /^#[0-9a-f]{6}$/i.test(String(value)) ? String(value) : '#d9a93b';
}

function generateId() {
    return randomBytes(9).toString('base64url');
}

function shuffleArray(array) {
    const out = [...array];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

function getClientIP(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) return String(forwarded).split(',')[0].trim();
    return req.socket.remoteAddress || 'unknown';
}

// ============================================
// PERSISTENCE (atomic JSON files next to server.js — never web-served)
// ============================================

function readJSON(file, fallback) {
    try {
        if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
    } catch (e) {
        console.error(`[Storage] Failed to read ${file}:`, e.message);
    }
    return fallback;
}

function writeJSON(file, data) {
    try {
        const tmp = `${file}.tmp`;
        writeFileSync(tmp, JSON.stringify(data, null, 2));
        renameSync(tmp, file);
    } catch (e) {
        console.error(`[Storage] Failed to write ${file}:`, e.message);
    }
}

// ── Bans ──
const BANS_FILE = join(__dirname, 'bans.json');
let bans = new Map(Object.entries(readJSON(BANS_FILE, {})));

function pruneBans() {
    const now = Date.now();
    let changed = false;
    for (const [ip, ban] of bans) {
        if (ban.expiresAt && ban.expiresAt < now) { bans.delete(ip); changed = true; }
    }
    if (changed) saveBans();
}
function saveBans() { writeJSON(BANS_FILE, Object.fromEntries(bans)); }
function isIPBanned(ip) {
    pruneBans();
    return bans.get(ip) || null;
}
pruneBans();
console.log(`[Bans] ${bans.size} active bans`);

// ── Leaderboard ──
const LEADERBOARD_FILE = join(__dirname, 'leaderboard.json');
let leaderboard = readJSON(LEADERBOARD_FILE, []);
if (!Array.isArray(leaderboard)) leaderboard = [];
// Sanitize entries written by older versions (names were stored unescaped).
leaderboard = leaderboard
    .filter(e => e && typeof e.score === 'number')
    .map(e => ({ ...e, name: cleanText(e.name, 20) || 'Explorer', color: cleanColor(e.color) }));
console.log(`[Leaderboard] ${leaderboard.length} entries`);

// ============================================
// RATE LIMITING
// ============================================

const rateLimits = new Map(); // `${bucket}:${ip}` -> timestamps[]

function isRateLimited(ip, bucket, max, windowMs) {
    const key = `${bucket}:${ip}`;
    const now = Date.now();
    const hits = (rateLimits.get(key) || []).filter(t => now - t < windowMs);
    if (hits.length >= max) { rateLimits.set(key, hits); return true; }
    hits.push(now);
    rateLimits.set(key, hits);
    return false;
}

setInterval(() => {
    const now = Date.now();
    for (const [key, hits] of rateLimits) {
        const fresh = hits.filter(t => now - t < 120000);
        if (fresh.length) rateLimits.set(key, fresh); else rateLimits.delete(key);
    }
}, 60000).unref();

const LIMITS = {
    connections: [10, 60000],
    messages: [40, 10000],
    lobbies: [3, 30000],
    api: [60, 60000],
    leaderboard: [6, 60000],
};

// ============================================
// EXPRESS
// ============================================

const app = express();
const server = createServer(app);
app.disable('x-powered-by');
app.set('trust proxy', true);
app.use(compression());

app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});

// CORS for a game client served from another site (see ALLOWED_ORIGINS)
app.use('/api', (req, res, next) => {
    const origin = req.headers.origin;
    if (isAllowedOrigin(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Key');
        res.setHeader('Access-Control-Max-Age', '600');
    }
    res.append('Vary', 'Origin');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

// SEO: crawler hints
app.get('/robots.txt', (req, res) => {
    res.type('text/plain').send(
        `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${PUBLIC_URL}/sitemap.xml\n`);
});

const DEPLOYED_ON = new Date().toISOString().slice(0, 10);
app.get('/sitemap.xml', (req, res) => {
    const lastmod = DEPLOYED_ON;
    res.type('application/xml').send(
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        `  <url><loc>${PUBLIC_URL}/</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>\n` +
        `</urlset>\n`);
});

app.get('/healthz', (req, res) => res.json({ ok: true, version: VERSION }));
app.get('/api/version', (req, res) => res.json({ version: VERSION }));

// Admin panel (no-index, not frameable)
app.get('/admin', (req, res) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(join(PUBLIC_DIR, 'admin', 'index.html'));
});

// three.js served from node_modules so the game never depends on a third-party CDN
app.use('/vendor/three', express.static(join(__dirname, 'node_modules', 'three'), {
    maxAge: '30d', immutable: true, index: false,
}));

// Media, fonts and icons: long-lived cache
app.use('/public', express.static(PUBLIC_DIR, {
    index: false,
    setHeaders(res, path) {
        if (/[\\/]admin[\\/]/.test(path)) res.setHeader('Cache-Control', 'no-store');
        else if (/\.(woff2?)$/.test(path)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        else res.setHeader('Cache-Control', 'public, max-age=604800');
    },
}));

// Game client: always revalidate so a new release is picked up immediately
app.use(express.static(CLIENT_DIR, {
    setHeaders(res) { res.setHeader('Cache-Control', 'no-cache'); },
}));

app.use('/api', (req, res, next) => {
    if (isRateLimited(getClientIP(req), 'api', ...LIMITS.api)) {
        return res.status(429).json({ error: 'Too many requests' });
    }
    next();
});
app.use('/api', express.json({ limit: '8kb' }));

// ── Leaderboard API ──
app.get('/api/leaderboard', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.json(leaderboard.slice(0, 50));
});

app.post('/api/leaderboard', (req, res) => {
    if (isRateLimited(getClientIP(req), 'leaderboard', ...LIMITS.leaderboard)) {
        return res.status(429).json({ error: 'Too many submissions' });
    }
    const body = req.body || {};
    const name = cleanText(body.name, 20) || 'Explorer';
    const rounds = Number(body.rounds);
    const correct = Number(body.correct);
    const score = Math.round(Number(body.score));

    if (!ROUND_OPTIONS.includes(rounds)) return res.status(400).json({ error: 'Invalid rounds' });
    if (!Number.isInteger(correct) || correct < 0 || correct > rounds) return res.status(400).json({ error: 'Invalid result' });
    if (!Number.isFinite(score) || score <= 0 || score > correct * maxPointsPerRound()) {
        return res.status(400).json({ error: 'Invalid score' });
    }

    const entry = {
        name,
        score,
        rounds,
        correct,
        accuracy: Math.round((correct / rounds) * 100),
        color: cleanColor(body.color),
        mode: body.mode === 'daily' ? 'daily' : 'expedition',
        date: new Date().toISOString(),
        id: generateId(),
    };

    leaderboard.push(entry);
    leaderboard.sort((a, b) => b.score - a.score);
    leaderboard = leaderboard.slice(0, 100);
    writeJSON(LEADERBOARD_FILE, leaderboard);

    const rank = leaderboard.findIndex(e => e.id === entry.id) + 1;
    res.json({ success: true, rank: rank || null, total: leaderboard.length, id: entry.id });
});

// ============================================
// ADMIN API
// ============================================

const adminConnections = new Set();

function adminLog(type, message) {
    const payload = JSON.stringify({ type: 'admin_log', logType: type, message });
    adminConnections.forEach(ws => { try { ws.send(payload); } catch { /* closed */ } });
    console.log(`[${type.toUpperCase()}] ${message}`);
}

function checkAdminKey(req, res, next) {
    if (!isAdminKey(req.headers['x-admin-key'])) return res.status(403).json({ error: 'Invalid admin key' });
    res.setHeader('Cache-Control', 'no-store');
    next();
}

const serverStats = {
    startedAt: Date.now(),
    totalConnections: 0,
    peakPlayers: 0,
    totalGamesPlayed: 0,
    totalGuesses: 0,
};

app.get('/api/admin/verify', checkAdminKey, (req, res) => res.json({ ok: true, version: VERSION }));

app.get('/api/admin/stats', checkAdminKey, (req, res) => {
    const lobbyList = [...lobbies.values()].map(lobby => {
        const gs = lobby.gameState;
        return {
            code: lobby.code,
            name: lobby.name,
            hostId: lobby.hostId,
            playerCount: lobby.players.length,
            players: lobby.players.map(p => ({ id: p.id, name: p.name, score: p.score || 0 })),
            settings: { ...lobby.settings, password: undefined, hasPassword: !!lobby.settings.password },
            gameState: gs ? {
                inProgress: !gs.isGameOver,
                gameOver: gs.isGameOver,
                currentRound: gs.currentRound,
                totalRounds: gs.totalRounds,
                currentCountry: gs.countries[gs.currentRound - 1] || null,
            } : null,
        };
    });

    const playerList = [...players.values()].map(p => ({
        id: p.id, name: p.name, lobbyCode: p.lobbyCode, score: p.score, ip: p.ip,
    }));

    res.json({
        version: VERSION,
        players: { online: players.size, peak: serverStats.peakPlayers, list: playerList },
        lobbies: { total: lobbies.size, inGame: lobbyList.filter(l => l.gameState?.inProgress).length, list: lobbyList },
        stats: {
            totalGamesPlayed: serverStats.totalGamesPlayed,
            totalGuesses: serverStats.totalGuesses,
            totalConnections: serverStats.totalConnections,
            uptimeSeconds: Math.floor((Date.now() - serverStats.startedAt) / 1000),
            startedAt: new Date(serverStats.startedAt).toISOString(),
            leaderboardEntries: leaderboard.length,
        },
    });
});

app.post('/api/admin/lobby/:code/close', checkAdminKey, (req, res) => {
    const lobby = lobbies.get(req.params.code);
    if (!lobby) return res.status(404).json({ error: 'Lobby not found' });
    lobby.players.forEach(p => {
        sendTo(p.id, { type: 'lobby_closed', reason: 'This expedition was closed by an administrator.' });
        const pd = players.get(p.id);
        if (pd) pd.lobbyCode = null;
    });
    lobby.destroy();
    lobbies.delete(req.params.code);
    adminLog('admin', `Lobby ${req.params.code} closed by admin`);
    res.json({ success: true });
});

app.post('/api/admin/lobby/:code/kick/:playerId', checkAdminKey, (req, res) => {
    const lobby = lobbies.get(req.params.code);
    if (!lobby) return res.status(404).json({ error: 'Lobby not found' });
    sendTo(req.params.playerId, { type: 'kicked', reason: 'You were removed from the expedition by an administrator.' });
    removeFromLobby(req.params.playerId, lobby);
    adminLog('admin', `Kicked player ${req.params.playerId} from lobby ${req.params.code}`);
    res.json({ success: true });
});

app.post('/api/admin/broadcast', checkAdminKey, (req, res) => {
    const msg = cleanText(req.body?.message, 280);
    if (!msg) return res.status(400).json({ error: 'No message' });
    const payload = JSON.stringify({ type: 'server_message', message: msg });
    connections.forEach(ws => { try { ws.send(payload); } catch { /* closed */ } });
    adminLog('admin', `Broadcast: "${msg}"`);
    res.json({ success: true, recipients: connections.size });
});

function banIP(ip, { reason, duration, name }) {
    const hours = Number(duration);
    const ban = {
        reason: cleanText(reason, 200) || 'Banned by admin',
        bannedAt: Date.now(),
        expiresAt: hours > 0 ? Date.now() + hours * 3600000 : null,
        bannedName: cleanText(name, 40) || 'Unknown',
    };
    bans.set(ip, ban);
    saveBans();
    players.forEach((player, playerId) => {
        if (player.ip !== ip) return;
        const ws = connections.get(playerId);
        if (ws) {
            ws.send(JSON.stringify({ type: 'banned', reason: ban.reason, expiresAt: ban.expiresAt }));
            setTimeout(() => ws.close(), 500);
        }
    });
    return ban;
}

app.post('/api/admin/ban/:playerId', checkAdminKey, (req, res) => {
    const player = players.get(req.params.playerId);
    if (!player) return res.status(404).json({ error: 'Player not found' });
    if (!player.ip || player.ip === 'unknown') return res.status(400).json({ error: 'Cannot determine player IP' });
    const ban = banIP(player.ip, { ...req.body, name: player.name });
    if (player.lobbyCode) removeFromLobby(player.id, lobbies.get(player.lobbyCode));
    const durationText = ban.expiresAt ? `${req.body.duration}h` : 'permanent';
    adminLog('admin', `BANNED ${player.name} (IP: ${player.ip}) — ${durationText}: ${ban.reason}`);
    res.json({ success: true, ip: player.ip, duration: durationText });
});

app.post('/api/admin/ban-ip', checkAdminKey, (req, res) => {
    const ip = cleanText(req.body?.ip, 64);
    if (!ip) return res.status(400).json({ error: 'No IP provided' });
    const ban = banIP(ip, { ...req.body, name: 'Manual IP ban' });
    adminLog('admin', `IP BANNED ${ip} — ${ban.expiresAt ? `${req.body.duration}h` : 'permanent'}: ${ban.reason}`);
    res.json({ success: true });
});

app.post('/api/admin/unban/:ip', checkAdminKey, (req, res) => {
    const ip = decodeURIComponent(req.params.ip);
    if (!bans.has(ip)) return res.status(404).json({ error: 'IP not banned' });
    bans.delete(ip);
    saveBans();
    adminLog('admin', `Unbanned IP: ${ip}`);
    res.json({ success: true });
});

app.get('/api/admin/bans', checkAdminKey, (req, res) => {
    pruneBans();
    res.json({ bans: [...bans.entries()].map(([ip, ban]) => ({ ip, ...ban })) });
});

app.delete('/api/admin/leaderboard/:id', checkAdminKey, (req, res) => {
    const before = leaderboard.length;
    leaderboard = leaderboard.filter(e => e.id !== req.params.id);
    if (leaderboard.length === before) return res.status(404).json({ error: 'Entry not found' });
    writeJSON(LEADERBOARD_FILE, leaderboard);
    adminLog('admin', `Removed leaderboard entry ${req.params.id}`);
    res.json({ success: true });
});

app.use((req, res) => res.status(404).type('text/plain').send('Not found'));

// ============================================
// LOBBIES
// ============================================

const lobbies = new Map();     // code -> Lobby
const players = new Map();     // playerId -> player
const connections = new Map(); // playerId -> ws

function generateLobbyCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code;
    do {
        code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    } while (lobbies.has(code));
    return code;
}

function sendTo(playerId, message) {
    const ws = connections.get(playerId);
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(message));
}

function broadcast(lobby, message, excludeId = null) {
    const payload = JSON.stringify(message);
    lobby.players.forEach(p => {
        if (p.id === excludeId) return;
        const ws = connections.get(p.id);
        if (ws && ws.readyState === 1) ws.send(payload);
    });
}

class Lobby {
    constructor(host, settings) {
        this.code = generateLobbyCode();
        this.name = cleanText(settings.lobbyName, 30) || `${host.name}'s Expedition`;
        this.hostId = host.id;
        this.settings = {
            maxPlayers: clampToOption(settings.maxPlayers, MAX_PLAYER_OPTIONS, 6),
            rounds: clampToOption(settings.rounds, ROUND_OPTIONS, 5),
            timePerRound: clampToOption(settings.timePerRound, TIME_OPTIONS, 120),
            isPrivate: !!settings.isPrivate,
            password: settings.password ? cleanText(settings.password, 32) || null : null,
        };
        this.players = [];
        this.bannedIds = new Set();
        this.gameState = null;
        this.timers = new Set();
    }

    later(fn, ms) {
        const t = setTimeout(() => { this.timers.delete(t); fn(); }, ms);
        this.timers.add(t);
        return t;
    }

    every(fn, ms) {
        const t = setInterval(fn, ms);
        this.timers.add(t);
        return t;
    }

    clear(t) {
        if (!t) return;
        clearTimeout(t);
        clearInterval(t);
        this.timers.delete(t);
    }

    destroy() {
        this.timers.forEach(t => { clearTimeout(t); clearInterval(t); });
        this.timers.clear();
        this.gameState = null;
    }

    publicInfo() {
        return {
            code: this.code,
            name: this.name,
            playerCount: this.players.length,
            maxPlayers: this.settings.maxPlayers,
            rounds: this.settings.rounds,
            timePerRound: this.settings.timePerRound,
            hasPassword: !!this.settings.password,
        };
    }

    fullInfo() {
        return {
            code: this.code,
            name: this.name,
            hostId: this.hostId,
            settings: {
                maxPlayers: this.settings.maxPlayers,
                rounds: this.settings.rounds,
                timePerRound: this.settings.timePerRound,
                isPrivate: this.settings.isPrivate,
                hasPassword: !!this.settings.password,
            },
            inGame: !!this.gameState,
            players: this.playerList(),
        };
    }

    playerList() {
        return this.players.map(p => ({ id: p.id, name: p.name, color: p.color, score: p.score || 0 }));
    }

    standings() {
        return this.players
            .map(p => ({
                id: p.id,
                name: p.name,
                color: p.color,
                score: this.gameState?.scores[p.id] ?? p.score ?? 0,
                correct: this.gameState?.correct[p.id] || 0,
            }))
            .sort((a, b) => b.score - a.score);
    }

    // ── game flow ──

    startGame() {
        const pool = [];
        while (pool.length < this.settings.rounds) pool.push(...shuffleArray(SITE_NAMES));
        this.gameState = {
            currentRound: 0,
            totalRounds: this.settings.rounds,
            countries: pool.slice(0, this.settings.rounds),
            seeds: Array.from({ length: this.settings.rounds }, () => Math.floor(Math.random() * 2 ** 31)),
            scores: {},
            correct: {},
            roundGuesses: {},
            readyPlayers: new Set(),
            roundStartTime: null,
            isRoundActive: false,
            isRoundPending: false,
            isGameOver: false,
        };
        this.players.forEach(p => {
            this.gameState.scores[p.id] = 0;
            this.gameState.correct[p.id] = 0;
            p.score = 0;
        });
    }

    startRound() {
        const gs = this.gameState;
        if (!gs || gs.isRoundActive || gs.isRoundPending || gs.isGameOver) return;
        gs.currentRound++;
        gs.roundGuesses = {};
        gs.readyPlayers = new Set();
        gs.isRoundPending = true;
        this.clear(this.nextRoundTimer);

        broadcast(this, {
            type: 'round_start',
            round: gs.currentRound,
            totalRounds: gs.totalRounds,
            country: gs.countries[gs.currentRound - 1],
            seed: gs.seeds[gs.currentRound - 1],
            timeLimit: this.settings.timePerRound,
        });
        this.readyTimer = this.later(() => {
            console.log(`[Lobby ${this.code}] Ready timeout — starting round ${gs.currentRound}`);
            this.activateRound();
        }, READY_TIMEOUT_MS);
    }

    playerReady(playerId) {
        const gs = this.gameState;
        if (!gs || !gs.isRoundPending) return;
        gs.readyPlayers.add(playerId);
        if (this.players.every(p => gs.readyPlayers.has(p.id))) this.activateRound();
    }

    activateRound() {
        const gs = this.gameState;
        if (!gs || !gs.isRoundPending) return;
        this.clear(this.readyTimer);
        gs.isRoundPending = false;
        gs.isRoundActive = true;
        gs.roundStartTime = Date.now();

        const timing = () => ({
            serverTime: Date.now(),
            roundStartTime: gs.roundStartTime,
            timePerRound: this.settings.timePerRound,
            timeRemaining: Math.floor(this.timeRemaining()),
        });
        broadcast(this, { type: 'round_go', ...timing() });

        if (this.settings.timePerRound > 0) {
            this.roundTimer = this.later(() => this.endRound(), this.settings.timePerRound * 1000);
            this.syncTimer = this.every(() => {
                if (!gs.isRoundActive) return this.clear(this.syncTimer);
                broadcast(this, { type: 'timer_sync', ...timing() });
            }, 5000);
        }
    }

    timeRemaining() {
        const gs = this.gameState;
        if (!gs?.roundStartTime || this.settings.timePerRound === 0) return 0;
        return Math.max(0, this.settings.timePerRound - (Date.now() - gs.roundStartTime) / 1000);
    }

    submitGuess(playerId, guessText, recovered) {
        const gs = this.gameState;
        if (!gs || !gs.isRoundActive || gs.roundGuesses[playerId]) return null;
        const answer = gs.countries[gs.currentRound - 1];
        const resolved = resolveCountry(guessText);
        if (!resolved) return null; // client only submits known countries
        const isCorrect = resolved === answer;
        const finds = Math.max(0, Math.min(5, Math.floor(Number(recovered) || 0)));
        const points = isCorrect ? pointsForCorrect(finds, this.timeRemaining()) : -WRONG_GUESS_PENALTY;

        gs.roundGuesses[playerId] = { guess: resolved, isCorrect, points, finds };
        gs.scores[playerId] = Math.max(0, (gs.scores[playerId] || 0) + points);
        if (isCorrect) gs.correct[playerId] = (gs.correct[playerId] || 0) + 1;
        const player = this.players.find(p => p.id === playerId);
        if (player) player.score = gs.scores[playerId];
        return { playerId, playerName: player?.name, isCorrect, points: isCorrect ? points : 0 };
    }

    allGuessed() {
        const gs = this.gameState;
        return !!gs && this.players.length > 0 && this.players.every(p => gs.roundGuesses[p.id]);
    }

    endRound() {
        const gs = this.gameState;
        if (!gs || !gs.isRoundActive) return;
        gs.isRoundActive = false;
        this.clear(this.roundTimer);
        this.clear(this.syncTimer);
        gs.isGameOver = gs.currentRound >= gs.totalRounds;

        const results = this.players.map(p => {
            const g = gs.roundGuesses[p.id];
            return {
                playerId: p.id,
                playerName: p.name,
                color: p.color,
                isCorrect: !!g?.isCorrect,
                isTimeout: !g,
                guess: g?.guess || null,
                points: g ? g.points : 0,
                finds: g?.finds ?? null,
            };
        });

        broadcast(this, {
            type: 'round_end',
            round: gs.currentRound,
            totalRounds: gs.totalRounds,
            correctAnswer: gs.countries[gs.currentRound - 1],
            results,
            standings: this.standings(),
            isGameOver: gs.isGameOver,
            nextRoundIn: gs.isGameOver ? 0 : ROUND_BREAK_MS,
        });

        if (gs.isGameOver) {
            this.later(() => this.endGame(), 1500);
        } else {
            this.nextRoundTimer = this.later(() => this.startRound(), ROUND_BREAK_MS);
        }
    }

    endGame() {
        const gs = this.gameState;
        if (!gs) return;
        const standings = this.standings();
        this.players.forEach(p => sendTo(p.id, {
            type: 'game_end',
            standings,
            winner: standings[0] || null,
            yourScore: gs.scores[p.id] || 0,
            yourCorrect: gs.correct[p.id] || 0,
            totalRounds: gs.totalRounds,
        }));
        adminLog('game', `Game finished in ${this.code} — winner ${standings[0]?.name || 'nobody'}`);
        this.destroy();
    }
}

function removeFromLobby(playerId, lobby) {
    if (!lobby) return;
    const player = players.get(playerId);
    lobby.players = lobby.players.filter(p => p.id !== playerId);
    if (player) player.lobbyCode = null;

    if (lobby.players.length === 0) {
        lobby.destroy();
        lobbies.delete(lobby.code);
        adminLog('lobby', `Lobby ${lobby.code} closed (empty)`);
        return;
    }

    if (lobby.hostId === playerId) {
        lobby.hostId = lobby.players[0].id;
        broadcast(lobby, { type: 'host_changed', newHostId: lobby.hostId });
    }
    broadcast(lobby, { type: 'lobby_update', lobby: lobby.fullInfo(), leftId: playerId });

    // The leaver may have been the last player we were waiting on.
    const gs = lobby.gameState;
    if (gs?.isRoundPending && lobby.players.every(p => gs.readyPlayers.has(p.id))) lobby.activateRound();
    if (gs?.isRoundActive && lobby.allGuessed()) lobby.endRound();
}

// ============================================
// WEBSOCKETS
// ============================================

const wss = new WebSocketServer({ server, maxPayload: 16 * 1024 });

wss.on('connection', (ws, req) => {
    const ip = getClientIP(req);

    const ban = isIPBanned(ip);
    if (ban) {
        ws.send(JSON.stringify({ type: 'banned', reason: ban.reason, expiresAt: ban.expiresAt || null }));
        ws.close();
        adminLog('connect', `Banned IP ${ip} attempted to connect`);
        return;
    }
    if (isRateLimited(ip, 'connections', ...LIMITS.connections)) {
        ws.send(JSON.stringify({ type: 'error', code: 'rate_limited', message: 'Too many connections. Please wait a moment.' }));
        ws.close();
        return;
    }

    const playerId = generateId();
    const player = { id: playerId, name: null, lobbyCode: null, score: 0, ip, color: '#d9a93b' };
    players.set(playerId, player);
    connections.set(playerId, ws);
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    serverStats.totalConnections++;
    serverStats.peakPlayers = Math.max(serverStats.peakPlayers, players.size);
    ws.send(JSON.stringify({ type: 'connected', playerId, version: VERSION }));

    ws.on('message', data => {
        if (isRateLimited(ip, 'messages', ...LIMITS.messages)) {
            ws.send(JSON.stringify({ type: 'error', code: 'rate_limited', message: 'Slow down — too many actions.' }));
            return;
        }
        let message;
        try { message = JSON.parse(data); } catch { return; }
        if (!message || typeof message.type !== 'string') return;

        if (message.type === 'admin_subscribe') {
            if (isAdminKey(message.key)) {
                adminConnections.add(ws);
                ws.send(JSON.stringify({ type: 'admin_subscribed' }));
            }
            return;
        }
        try {
            handleMessage(player, message);
        } catch (e) {
            console.error('[Server] Message handler error:', e);
        }
    });

    ws.on('close', () => {
        adminConnections.delete(ws);
        if (player.lobbyCode) removeFromLobby(playerId, lobbies.get(player.lobbyCode));
        players.delete(playerId);
        connections.delete(playerId);
        if (player.name) adminLog('disconnect', `${player.name} disconnected (${players.size} online)`);
    });
});

// Drop dead sockets so lobbies don't wait on ghosts.
setInterval(() => {
    wss.clients.forEach(ws => {
        if (!ws.isAlive) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
    });
}, 30000).unref();

function lobbyOf(player) {
    return player.lobbyCode ? lobbies.get(player.lobbyCode) : null;
}

function errorTo(player, code, message) {
    sendTo(player.id, { type: 'error', code, message });
}

function handleMessage(player, message) {
    switch (message.type) {
        case 'create_lobby': {
            if (isRateLimited(player.ip, 'lobbies', ...LIMITS.lobbies)) {
                return errorTo(player, 'rate_limited', 'Please wait a moment before creating another expedition.');
            }
            if (player.lobbyCode) removeFromLobby(player.id, lobbyOf(player));
            player.name = cleanText(message.hostName, 20) || 'Host';
            player.color = cleanColor(message.color);
            const lobby = new Lobby(player, message);
            lobby.players.push(player);
            player.lobbyCode = lobby.code;
            lobbies.set(lobby.code, lobby);
            adminLog('lobby', `Lobby "${lobby.name}" (${lobby.code}) created by ${player.name}`);
            sendTo(player.id, { type: 'lobby_joined', lobby: lobby.fullInfo(), isHost: true });
            break;
        }

        case 'join_lobby': {
            const code = cleanText(message.lobbyCode, 8).toUpperCase();
            const lobby = lobbies.get(code);
            if (!lobby) return errorTo(player, 'not_found', 'No expedition found with that code.');
            if (lobby.settings.password && lobby.settings.password !== String(message.password ?? '')) {
                return errorTo(player, 'bad_password', 'Incorrect password.');
            }
            if (lobby.gameState) return errorTo(player, 'in_progress', 'That expedition has already set off.');
            if (lobby.bannedIds.has(player.id) || lobby.bannedIds.has(player.ip)) {
                return errorTo(player, 'banned', 'You can’t join this expedition.');
            }
            if (lobby.players.length >= lobby.settings.maxPlayers) return errorTo(player, 'full', 'That expedition is full.');
            if (player.lobbyCode && player.lobbyCode !== code) removeFromLobby(player.id, lobbyOf(player));

            player.name = cleanText(message.playerName, 20) || 'Explorer';
            player.color = cleanColor(message.color);
            if (!lobby.players.includes(player)) lobby.players.push(player);
            player.lobbyCode = lobby.code;
            adminLog('lobby', `${player.name} joined lobby ${lobby.code}`);
            sendTo(player.id, { type: 'lobby_joined', lobby: lobby.fullInfo(), isHost: false });
            broadcast(lobby, { type: 'lobby_update', lobby: lobby.fullInfo(), joinedId: player.id }, player.id);
            break;
        }

        case 'leave_lobby':
            removeFromLobby(player.id, lobbyOf(player));
            break;

        case 'kick_player':
        case 'ban_player': {
            const lobby = lobbyOf(player);
            if (!lobby || lobby.hostId !== player.id) return;
            const target = players.get(message.targetId);
            if (!target || target.id === player.id || target.lobbyCode !== lobby.code) return;
            if (message.type === 'ban_player') {
                lobby.bannedIds.add(target.id);
                lobby.bannedIds.add(target.ip);
            }
            sendTo(target.id, { type: 'kicked', reason: message.type === 'ban_player'
                ? 'The host banned you from this expedition.' : 'The host removed you from the expedition.' });
            removeFromLobby(target.id, lobby);
            adminLog('lobby', `${target.name} was ${message.type === 'ban_player' ? 'banned' : 'kicked'} from ${lobby.code}`);
            break;
        }

        case 'get_lobbies':
            sendTo(player.id, {
                type: 'lobby_list',
                lobbies: [...lobbies.values()]
                    .filter(l => !l.settings.isPrivate && !l.gameState)
                    .map(l => l.publicInfo()),
            });
            break;

        case 'start_game': {
            const lobby = lobbyOf(player);
            if (!lobby || lobby.hostId !== player.id || lobby.gameState) return;
            serverStats.totalGamesPlayed++;
            adminLog('game', `Game started in lobby ${lobby.code} (${lobby.players.length} players)`);
            lobby.startGame();
            broadcast(lobby, {
                type: 'game_starting',
                countdown: 3,
                settings: { rounds: lobby.settings.rounds, timePerRound: lobby.settings.timePerRound },
                players: lobby.playerList(),
            });
            lobby.later(() => lobby.startRound(), 3200);
            break;
        }

        case 'player_ready': {
            const lobby = lobbyOf(player);
            if (lobby) lobby.playerReady(player.id);
            break;
        }

        case 'submit_guess': {
            const lobby = lobbyOf(player);
            if (!lobby?.gameState) return;
            const result = lobby.submitGuess(player.id, message.guess, message.recovered ?? message.artifactsFound);
            if (!result) return;
            serverStats.totalGuesses++;
            adminLog('game', `${player.name} guessed "${cleanText(message.guess, 40)}" in ${lobby.code} — ${result.isCorrect ? 'correct' : 'wrong'}`);
            broadcast(lobby, { type: 'player_guessed', ...result });
            broadcast(lobby, { type: 'score_update', standings: lobby.standings() });
            if (lobby.allGuessed()) lobby.endRound();
            break;
        }

        case 'request_next_round':
            // Rounds are paced by the server since 1.0.1; kept for older clients.
            break;
    }
}

// ============================================
// START
// ============================================

server.listen(PORT, () => {
    console.log(`\n  UNEARTH v${VERSION}\n  Game:  http://localhost:${PORT}\n  Admin: http://localhost:${PORT}/admin\n`);
});
