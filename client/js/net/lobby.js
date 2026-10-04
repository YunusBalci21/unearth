// ============================================
// LOBBY CLIENT — one reconnecting WebSocket, surfaced as events.
// ============================================

import { socketUrl } from './endpoint.js';

class LobbyClient extends EventTarget {
    constructor() {
        super();
        this.socket = null;
        this.playerId = null;
        this.lobby = null;
        this.isHost = false;
        this.status = 'offline';
        this.retry = 0;
        this.retryTimer = null;
        this.waiters = [];
    }

    emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }
    on(type, fn) { const h = e => fn(e.detail); this.addEventListener(type, h); return () => this.removeEventListener(type, h); }

    setStatus(s) {
        if (this.status === s) return;
        this.status = s;
        this.emit('status', s);
    }

    /** Resolves when the socket is open (or rejects after timeoutMs). */
    connect(timeoutMs = 8000) {
        if (this.socket?.readyState === WebSocket.OPEN && this.playerId) return Promise.resolve();
        if (!this.socket || this.socket.readyState > WebSocket.OPEN) this.open();
        return new Promise((resolve, reject) => {
            const t = setTimeout(() => {
                this.waiters = this.waiters.filter(w => w.resolve !== resolve);
                reject(new Error('Could not reach the expedition server.'));
            }, timeoutMs);
            this.waiters.push({ resolve: () => { clearTimeout(t); resolve(); } });
        });
    }

    open() {
        clearTimeout(this.retryTimer);
        let ws;
        try { ws = new WebSocket(socketUrl()); } catch { this.scheduleRetry(); return; }
        this.socket = ws;
        this.setStatus('connecting');
        ws.onmessage = e => {
            let msg;
            try { msg = JSON.parse(e.data); } catch { return; }
            this.handle(msg);
        };
        ws.onclose = () => {
            if (this.socket !== ws) return;
            const wasInLobby = !!this.lobby;
            this.playerId = null;
            this.lobby = null;
            this.isHost = false;
            this.setStatus('offline');
            if (wasInLobby) this.emit('disconnected');
            if (!this.banned) this.scheduleRetry();
        };
        ws.onerror = () => { /* onclose follows */ };
    }

    scheduleRetry() {
        clearTimeout(this.retryTimer);
        const delay = Math.min(15000, 1500 * 2 ** this.retry++);
        this.retryTimer = setTimeout(() => this.open(), delay);
    }

    send(type, data = {}) {
        if (this.socket?.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ type, ...data }));
            return true;
        }
        return false;
    }

    handle(msg) {
        switch (msg.type) {
            case 'connected':
                this.playerId = msg.playerId;
                this.retry = 0;
                this.setStatus('online');
                this.waiters.splice(0).forEach(w => w.resolve());
                break;
            case 'lobby_joined':
                this.lobby = msg.lobby;
                this.isHost = msg.lobby.hostId === this.playerId;
                this.emit('joined', this.lobby);
                break;
            case 'lobby_update':
                if (!this.lobby) return;
                this.lobby = msg.lobby;
                this.isHost = msg.lobby.hostId === this.playerId;
                this.emit('lobby', { lobby: this.lobby, joinedId: msg.joinedId, leftId: msg.leftId });
                break;
            case 'host_changed':
                if (!this.lobby) return;
                this.lobby.hostId = msg.newHostId;
                this.isHost = msg.newHostId === this.playerId;
                this.emit('lobby', { lobby: this.lobby, hostChanged: true });
                break;
            case 'lobby_list': this.emit('list', msg.lobbies); break;
            case 'error': this.emit('error', msg); break;
            case 'game_starting': this.emit('game-starting', msg); break;
            case 'round_start': this.emit('round-start', msg); break;
            case 'round_go': this.emit('round-go', msg); break;
            case 'timer_sync': this.emit('timer', msg); break;
            case 'player_guessed': this.emit('guessed', msg); break;
            case 'score_update': this.emit('scores', msg.standings); break;
            case 'round_end': this.emit('round-end', msg); break;
            case 'game_end': this.emit('game-end', msg); break;
            case 'kicked':
                this.lobby = null; this.isHost = false;
                this.emit('removed', msg.reason || 'You were removed from the expedition.');
                break;
            case 'lobby_closed':
                this.lobby = null; this.isHost = false;
                this.emit('removed', msg.reason || 'The expedition was closed.');
                break;
            case 'banned':
                this.banned = true;
                this.emit('banned', msg);
                break;
            case 'server_message': this.emit('broadcast', msg.message); break;
        }
    }

    // ---- actions ----
    requestList() { this.send('get_lobbies'); }
    create(opts) { this.send('create_lobby', opts); }
    join(code, playerName, color, password = null) { this.send('join_lobby', { lobbyCode: code, playerName, color, password }); }
    leave() { this.send('leave_lobby'); this.lobby = null; this.isHost = false; }
    kick(targetId) { this.send('kick_player', { targetId }); }
    ban(targetId) { this.send('ban_player', { targetId }); }
    start() { this.send('start_game'); }
    ready(round) { this.send('player_ready', { round }); }
    guess(country, recovered) { this.send('submit_guess', { guess: country, recovered }); }
}

export const lobby = new LobbyClient();
