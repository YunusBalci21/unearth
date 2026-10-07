// ============================================
// ENDPOINT — address of the game server (multiplayer, leaderboard, admin API).
// Same origin by default; a static deployment points it at the Node server
// through window.UNEARTH_SERVER (see /config.js).
// ============================================

const base = String(window.UNEARTH_SERVER || '').trim().replace(/\/+$/, '');

/** Absolute or same-origin URL for an API path such as "/api/leaderboard". */
export const apiUrl = path => `${base}${path}`;

/** WebSocket URL of the game server. */
export function socketUrl() {
    if (base) return base.replace(/^http/i, 'ws');
    return `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}`;
}
