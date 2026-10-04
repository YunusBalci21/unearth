// ============================================
// SCREENS — base camp menu, expedition setup, multiplayer, archive,
// leaderboard and settings.
// ============================================

import { $, $$, h, clear, svgIcon, fmtInt, fmtTime, dialogs, toast, segmented, swatches, copyText, initials, announce } from './dom.js';
import { settings, PLAYER_COLORS } from '../settings.js';
import { progress, RANKS } from '../progress.js';
import { audio } from '../audio.js';
import { lobby } from '../net/lobby.js';
import { REGIONS, SITES, sitesInRegion } from '../shared/countries.js';
import { ROUND_OPTIONS, TIME_OPTIONS, MAX_PLAYER_OPTIONS } from '../shared/rules.js';
import { CATALOG, ALL_ARTIFACTS, RARITIES } from '../data/catalog.js';
import { CONDITIONS } from '../game/site.js';
import { artifactThumbnail } from '../game/artifactModels.js';
import { dailyNumber } from '../game/expedition.js';
import { openInspector } from './inspector.js';
import { shareText, openShare } from '../share.js';

const timeLabel = t => (t === 0 ? '∞' : fmtTime(t));
const TIME_SEG = TIME_OPTIONS.filter(t => t !== 0).concat(0).map(t => ({ value: t, label: timeLabel(t), sub: t === 0 ? 'Relaxed' : t <= 60 ? 'Blitz' : t >= 180 ? 'Patient' : null }));
const ROUND_SEG = [3, 5, 10, 15].map(r => ({ value: r, label: String(r), sub: { 3: 'Quick', 5: 'Classic', 10: 'Long', 15: 'Epic' }[r] }));
const REGION_SEG = Object.values(REGIONS).map(r => ({ value: r.id, label: r.id === 'africa-me' ? 'Africa & ME' : r.id === 'americas' ? 'Americas & Oceania' : r.label }));

let app = null;

export function showScreen(id, { focus = true } = {}) {
    for (const el of $$('.screen')) el.classList.toggle('active', el.id === id);
    document.body.classList.toggle('in-menu', !!id);
    const target = id && document.getElementById(id);
    if (target && focus) {
        // Priority order, not document order: the primary action beats header icons
        const focusable = ['[autofocus]', '.btn-primary', 'input', 'button']
            .map(sel => target.querySelector(sel)).find(Boolean);
        setTimeout(() => focusable?.focus({ preventScroll: true }), 50);
    }
}

export function initScreens(appRef) {
    app = appRef;
    document.addEventListener('click', e => {
        const el = e.target.closest('[data-action]');
        if (!el) return;
        const handler = ACTIONS[el.dataset.action];
        if (handler) { audio.click(); handler(el, e); }
    });
    initSetup();
    initMultiplayer();
    initRoom();
    initSettings();
    refreshMenu();
}

const ACTIONS = {
    'new-expedition': () => openSetup(),
    daily: () => startDaily(),
    multiplayer: () => openMultiplayer(),
    'open-archive': () => openArchive(),
    'open-leaderboard': () => openLeaderboard(),
    'open-guide': () => dialogs.open('guide'),
    'open-settings': () => dialogs.open('settings'),
    'toggle-sound': el => {
        const muted = audio.toggleMute();
        updateSoundButtons();
        toast(muted ? 'Sound off' : 'Sound on', { icon: muted ? 'mute' : 'sound' });
        void el;
    },
    'back-to-menu': () => { showScreen('menu'); },
    'leave-lobby': () => { lobby.leave(); openMultiplayer(); },
};

export function updateSoundButtons() {
    const muted = settings.get('muted');
    for (const btn of $$('[data-action="toggle-sound"]')) {
        btn.setAttribute('aria-pressed', String(muted));
        btn.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
        btn.querySelector('use').setAttribute('href', muted ? '#i-mute' : '#i-sound');
    }
}

// ---------- Base camp ----------

export function refreshMenu() {
    const rank = progress.rank();
    $('#rank-seal').textContent = rank.seal;
    $('#rank-name').textContent = rank.name;
    $('#rank-bar').style.setProperty('--value', rank.progress);
    const unseen = progress.unseenCount;
    $('#rank-sub').textContent = `${rank.count} of ${ALL_ARTIFACTS.length} artifacts catalogued${unseen ? ` · ${unseen} new` : ''}`;
    const day = dailyNumber();
    const done = progress.dailyResult(day);
    $('#daily-meta').textContent = done ? `#${day} · ${fmtInt(done.score)} pts` : `#${day}`;
    updateSoundButtons();
}

// ---------- Solo setup ----------

let setupState = null;

function initSetup() {
    const last = settings.get('lastSolo') || {};
    setupState = { region: last.region || 'world', rounds: last.rounds || 5, time: last.time ?? 120 };
    const updateNote = () => {
        $('#setup-note').textContent = setupState.region === 'world'
            ? 'Worldwide expeditions count toward the global leaderboard.'
            : `${sitesInRegion(setupState.region).length} possible sites. Regional expeditions don’t count toward the global leaderboard.`;
    };
    segmented($('[data-seg="setup-region"]'), REGION_SEG, setupState.region, v => { setupState.region = v; updateNote(); });
    segmented($('[data-seg="setup-rounds"]'), ROUND_SEG, setupState.rounds, v => { setupState.rounds = v; });
    segmented($('[data-seg="setup-time"]'), TIME_SEG, setupState.time, v => { setupState.time = v; });
    updateNote();
    $('#setup-form').addEventListener('submit', e => {
        e.preventDefault();
        const name = $('#setup-name').value.trim().slice(0, 20);
        settings.patch({ name, lastSolo: { ...setupState } });
        dialogs.close('setup');
        app.startSolo({ mode: 'solo', ...setupState });
    });
}

function openSetup() {
    $('#setup-name').value = settings.get('name') || '';
    swatches($('#setup [data-swatches]'), PLAYER_COLORS, settings.get('color'), c => settings.set('color', c));
    dialogs.open('setup');
    setTimeout(() => $('#setup-name').focus(), 60);
}

function startDaily() {
    const day = dailyNumber();
    const done = progress.dailyResult(day);
    if (done) {
        const now = new Date();
        const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) - now.getTime();
        const hrs = Math.floor(next / 3600000), mins = Math.floor((next % 3600000) / 60000);
        toast(`Daily Dig #${day} complete — ${fmtInt(done.score)} pts. Next dig in ${hrs}h ${mins}m.`, { type: 'gold', icon: 'calendar', duration: 4500 });
        openShare({ daily: day, score: done.score, correct: done.correct, finds: done.finds, sites: done.sites, bestStreak: 0 });
        return;
    }
    app.startSolo({ mode: 'daily', daily: day, rounds: 5, time: 120, region: 'world' });
}

// ---------- Multiplayer ----------

let mpState = { rounds: 5, time: 120, players: 6 };

function initMultiplayer() {
    segmented($('[data-seg="host-rounds"]'), ROUND_OPTIONS.map(r => ({ value: r, label: String(r) })), mpState.rounds, v => { mpState.rounds = v; });
    segmented($('[data-seg="host-time"]'), TIME_SEG, mpState.time, v => { mpState.time = v; });
    segmented($('[data-seg="host-players"]'), MAX_PLAYER_OPTIONS.map(p => ({ value: p, label: String(p) })), mpState.players, v => { mpState.players = v; });

    $('#mp-name').addEventListener('change', e => settings.set('name', e.target.value.trim().slice(0, 20)));
    $('#refresh-lobbies').addEventListener('click', () => requestList());
    $('#join-code').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
    $('#join-form').addEventListener('submit', e => {
        e.preventDefault();
        const code = $('#join-code').value.trim();
        if (code.length < 4) { toast('Enter the six-character expedition code.', { type: 'bad' }); return; }
        joinLobby(code);
    });
    $('#host-form').addEventListener('submit', async e => {
        e.preventDefault();
        if (!(await ensureOnline())) return;
        const hostName = currentName();
        lobby.create({
            hostName,
            lobbyName: $('#host-lobby-name').value.trim(),
            rounds: mpState.rounds,
            timePerRound: mpState.time,
            maxPlayers: mpState.players,
            isPrivate: $('#host-private').checked,
            password: $('#host-password').value || null,
            color: settings.get('color'),
        });
    });

    lobby.on('status', s => {
        const badge = $('#mp-status');
        badge.className = `badge ${s === 'online' ? 'ok' : s === 'offline' ? 'bad' : ''}`;
        badge.textContent = s === 'online' ? 'Online' : s === 'offline' ? 'Offline — retrying' : 'Connecting…';
        if (s === 'online' && $('#mp').classList.contains('active')) requestList();
    });
    lobby.on('list', renderLobbyList);
    lobby.on('error', msg => {
        if (msg.code === 'bad_password' && pendingJoin) {
            askPassword(pendingJoin);
            return;
        }
        toast(msg.message || 'Something went wrong.', { type: 'bad' });
    });
    lobby.on('joined', () => { pendingJoin = null; openRoom(); });
}

function currentName() {
    const name = ($('#mp-name').value || settings.get('name') || '').trim().slice(0, 20) || 'Explorer';
    settings.set('name', name);
    return name;
}

async function ensureOnline() {
    try {
        await lobby.connect();
        return true;
    } catch {
        toast('Can’t reach the expedition server right now. Check your connection and try again.', { type: 'bad', duration: 4500 });
        return false;
    }
}

export async function openMultiplayer(prefillCode = '') {
    showScreen('mp');
    $('#mp-name').value = settings.get('name') || '';
    swatches($('#mp [data-swatches]'), PLAYER_COLORS, settings.get('color'), c => settings.set('color', c));
    if (prefillCode) $('#join-code').value = prefillCode;
    renderLobbyList(null);
    if (await ensureOnline()) requestList();
    else renderLobbyList([], true);
}

function requestList() {
    renderLobbyList(null);
    lobby.requestList();
}

function renderLobbyList(list, failed = false) {
    const host = clear($('#lobby-list'));
    if (list === null) {
        host.append(h('div.skeleton'), h('div.skeleton'), h('div.skeleton'));
        return;
    }
    if (failed) {
        host.append(h('div.empty', svgIcon('globe'), h('span', 'The expedition server is unreachable.'),
            h('button.btn.btn-sm', { type: 'button', onclick: () => openMultiplayer() }, svgIcon('refresh'), 'Try again')));
        return;
    }
    if (!list.length) {
        host.append(h('div.empty', svgIcon('users'), h('span', 'No open expeditions right now.'), h('span.kicker', 'Host one and share the code')));
        return;
    }
    for (const l of list) {
        host.append(h('div.lobby-item',
            h('div.meta',
                h('strong', l.name),
                h('span.kicker', `${l.playerCount}/${l.maxPlayers} explorers · ${l.rounds} sites · ${timeLabel(l.timePerRound ?? 120)}`)),
            l.hasPassword ? svgIcon('lock', 'muted') : null,
            h('button.btn.btn-sm', {
                type: 'button', disabled: l.playerCount >= l.maxPlayers,
                onclick: () => (l.hasPassword ? askPassword(l.code) : joinLobby(l.code)),
            }, l.playerCount >= l.maxPlayers ? 'Full' : 'Join')));
    }
}

let pendingJoin = null;

async function joinLobby(code, password = null) {
    if (!(await ensureOnline())) return;
    pendingJoin = code;
    lobby.join(code, currentName(), settings.get('color'), password);
}

function askPassword(code) {
    $('#prompt-title').textContent = 'Password required';
    $('#prompt-text').textContent = `Expedition ${code} is protected.`;
    const input = $('#prompt-input');
    input.value = '';
    dialogs.open('prompt', {
        onClose: v => { if (v === 'ok' && input.value) joinLobby(code, input.value); else pendingJoin = null; },
    });
    setTimeout(() => input.focus(), 60);
}

$('#prompt-form')?.addEventListener('submit', e => {
    e.preventDefault();
    dialogs.close('prompt', 'ok');
});

// ---------- Lobby room ----------

function initRoom() {
    $('#copy-code').addEventListener('click', async () => {
        if (await copyText(lobby.lobby?.code || '')) toast('Code copied', { type: 'ok', icon: 'copy' });
    });
    $('#copy-link').addEventListener('click', async () => {
        const url = `${location.origin}/?join=${lobby.lobby?.code}`;
        if (await copyText(url)) toast('Invite link copied — send it to your team', { type: 'ok', icon: 'link' });
    });
    $('#room-start').addEventListener('click', () => { audio.click(); lobby.start(); });
    lobby.on('lobby', ({ joinedId, leftId }) => {
        renderRoom();
        const who = id => lobby.lobby?.players.find(p => p.id === id)?.name;
        if (joinedId && joinedId !== lobby.playerId) { toast(`${who(joinedId) || 'An explorer'} joined`, { icon: 'users' }); audio.notify(); }
        if (leftId) toast('An explorer left the expedition', { icon: 'exit' });
    });
}

function openRoom() {
    showScreen('room');
    renderRoom();
    audio.notify();
}

export function renderRoom() {
    const l = lobby.lobby;
    if (!l) return;
    $('#room-title').textContent = l.name;
    $('#room-code').textContent = l.code;
    $('#room-count').textContent = `${l.players.length} / ${l.settings.maxPlayers}`;
    const team = clear($('#room-team'));
    for (const p of l.players) {
        const me = p.id === lobby.playerId;
        team.append(h('div.member',
            h('span.avatar', { style: { '--c': p.color } }, initials(p.name)),
            h('span.name', p.name, me ? h('span.muted', ' (you)') : null),
            p.id === l.hostId ? h('span.badge', svgIcon('crown'), 'Host') : null,
            lobby.isHost && !me ? h('button.icon-btn', { type: 'button', 'aria-label': `Remove ${p.name}`, title: 'Remove', onclick: () => lobby.kick(p.id) }, svgIcon('x')) : null,
            lobby.isHost && !me ? h('button.icon-btn', { type: 'button', 'aria-label': `Ban ${p.name}`, title: 'Ban from this expedition', onclick: () => lobby.ban(p.id) }, svgIcon('lock')) : null));
    }
    const facts = clear($('#room-facts'));
    const fact = (k, v) => facts.append(h('dt', k), h('dd', v));
    fact('Sites', String(l.settings.rounds));
    fact('Time per site', l.settings.timePerRound ? fmtTime(l.settings.timePerRound) : 'No limit');
    fact('Team size', `Up to ${l.settings.maxPlayers}`);
    fact('Visibility', l.settings.isPrivate ? 'Private' : 'Open list');
    if (l.settings.hasPassword) fact('Password', 'Required');
    $('#room-start').hidden = !lobby.isHost;
    $('#room-waiting').hidden = lobby.isHost;
    $('#room-start').innerHTML = '';
    $('#room-start').append(svgIcon('play'), l.players.length > 1 ? 'Set off' : 'Set off alone');
}

// ---------- Archive ----------

let archiveRegion = 'world';
let archiveCountry = null;

function openArchive(country = null) {
    archiveCountry = country;
    renderArchive();
    dialogs.open('archive', { onClose: () => refreshMenu() });
}

function renderArchive() {
    const body = clear($('#archive-body'));
    const rank = progress.rank();
    const legendary = Object.keys(progress.data.finds).filter(id => ALL_ARTIFACTS.find(a => a.id === id)?.rarity === 'legendary').length;
    body.append(h('div.panel-glass.archive-summary',
        h('span.seal', rank.seal),
        h('div.meta',
            h('div.row', h('strong.h2', rank.name), h('span.kicker', rank.next ? `${rank.next.min - rank.count} more to ${rank.next.name}` : 'Highest rank reached')),
            h('div.scalebar', { style: { '--value': rank.progress } }, h('span')),
            h('div.row',
                h('span.kicker', `${rank.count} / ${ALL_ARTIFACTS.length} catalogued`),
                h('span.kicker', `${legendary} / ${SITES.length} legendary`),
                h('span.kicker', `Museum value ${fmtInt(progress.totalValue())}`)))));

    if (archiveCountry) return renderCountry(body, archiveCountry);

    const tabs = h('div.tabs', { role: 'tablist', 'aria-label': 'Regions' });
    for (const r of Object.values(REGIONS)) {
        tabs.append(h('button', {
            type: 'button', role: 'tab', 'aria-selected': String(archiveRegion === r.id),
            onclick: () => { archiveRegion = r.id; renderArchive(); },
        }, r.id === 'world' ? 'All regions' : r.label));
    }
    body.append(tabs);
    if (rank.count === 0) {
        body.append(h('div.empty', svgIcon('archive'), h('span', 'Your archive is empty. Every artifact you recover in the field is catalogued here.')));
    }
    const grid = h('div.country-grid');
    for (const site of sitesInRegion(archiveRegion).sort((a, b) => a.name.localeCompare(b.name))) {
        const list = CATALOG[site.name];
        const prog = progress.countryProgress(site.name);
        grid.append(h('button.country-card', {
            type: 'button', class: prog.found === prog.total ? 'complete' : '',
            onclick: () => { archiveCountry = site.name; renderArchive(); },
        },
        h('span.top', h('strong', site.name), h('span.kicker', `${prog.found}/${prog.total}`)),
        h('span.pips', ...list.map(a => h('i', { class: `${progress.has(a.id) ? 'on' : ''} ${a.rarity === 'legendary' ? 'legendary' : ''}` }))),
        list.some(a => progress.entry(a.id)?.unseen) ? h('span.badge.new', { style: { justifySelf: 'start' } }, 'New finds') : null));
    }
    body.append(grid);
}

function renderCountry(body, country) {
    body.append(h('div.page-head',
        h('button.icon-btn', { type: 'button', 'aria-label': 'Back to all countries', onclick: () => { archiveCountry = null; renderArchive(); } }, svgIcon('back')),
        h('h3.h2', { style: { flex: 1 } }, country),
        h('span.kicker', `${progress.countryProgress(country).found} / 8`)));
    const grid = h('div.artifact-grid');
    for (const entry of CATALOG[country]) {
        const rec = progress.entry(entry.id);
        const img = h('img', { alt: '' });
        artifactThumbnail(entry).then(url => { if (url) img.src = url; });
        if (rec) {
            const card = h('button.artifact-card', {
                type: 'button',
                onclick: () => {
                    progress.markSeen(entry.id);
                    openInspector(entry, { revealed: true, condition: rec.best, onClose: () => renderArchive() });
                },
            },
            h('span.pic', img),
            h('span', { class: `rarity rarity-${entry.rarity}` }, RARITIES[entry.rarity].label),
            h('strong', entry.name),
            h('span.kicker', `${CONDITIONS[rec.best].label} · found ×${rec.count}`),
            rec.unseen ? h('span.badge.new', 'New') : null);
            grid.append(card);
        } else {
            grid.append(h('div.artifact-card.locked',
                h('span.pic', img),
                h('span', { class: `rarity rarity-${entry.rarity}` }, RARITIES[entry.rarity].label),
                h('strong', 'Undiscovered'),
                h('span.kicker', 'Still in the ground')));
        }
    }
    body.append(grid);
}

// ---------- Leaderboard ----------

const MY_ENTRIES_KEY = 'unearth_lb_ids';

export function rememberLeaderboardEntry(id) {
    try {
        const ids = JSON.parse(localStorage.getItem(MY_ENTRIES_KEY) || '[]');
        ids.push(id);
        localStorage.setItem(MY_ENTRIES_KEY, JSON.stringify(ids.slice(-50)));
    } catch { /* ignore */ }
}

async function openLeaderboard() {
    dialogs.open('leaderboard');
    const body = clear($('#lb-body'));
    for (let i = 0; i < 6; i++) body.append(h('div.skeleton', { style: { height: '44px' } }));
    let data;
    try {
        const res = await fetch('/api/leaderboard', { cache: 'no-store' });
        if (!res.ok) throw new Error(res.status);
        data = await res.json();
    } catch {
        clear(body).append(h('div.empty', svgIcon('globe'), h('span', 'Couldn’t load the leaderboard.'),
            h('button.btn.btn-sm', { type: 'button', onclick: () => openLeaderboard() }, svgIcon('refresh'), 'Retry')));
        return;
    }
    clear(body);
    const mine = new Set(JSON.parse(localStorage.getItem(MY_ENTRIES_KEY) || '[]'));
    if (progress.stats.bestScore > 0) body.append(h('p.note', svgIcon('trophy'), h('span', `Your best expedition: ${fmtInt(progress.stats.bestScore)} points`)));
    if (!data.length) {
        body.append(h('div.empty', svgIcon('trophy'), h('span', 'No scores yet — set off on a worldwide expedition to claim the top spot.')));
        return;
    }
    const list = h('div.lb-list');
    data.forEach((e, i) => {
        const date = e.date ? new Date(e.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
        list.append(h('div.lb-row', { class: mine.has(e.id) ? 'me' : '' },
            h('span.rk', i < 3 ? ['I', 'II', 'III'][i] : `${i + 1}`),
            h('span.dot', { style: { '--c': e.color || '#d9a93b' } }),
            h('span.n', e.name),
            h('span.d', `${e.correct}/${e.rounds}${e.mode === 'daily' ? ' · daily' : ''} · ${date}`),
            h('span.s', fmtInt(e.score))));
    });
    body.append(list);
}

// ---------- Settings ----------

function initSettings() {
    const bindRange = (id, key) => {
        const input = $(`#${id}`);
        const out = input.parentElement.querySelector('output');
        const sync = () => { out.textContent = `${input.value}%`; };
        input.value = Math.round(settings.get(key) * 100);
        sync();
        input.addEventListener('input', () => { settings.set(key, Number(input.value) / 100); sync(); });
    };
    bindRange('set-master', 'master');
    bindRange('set-music', 'music');
    bindRange('set-sfx', 'sfx');
    const bindSwitch = (id, key, after) => {
        const input = $(`#${id}`);
        input.checked = !!settings.get(key);
        input.addEventListener('change', () => { settings.set(key, input.checked); after?.(input.checked); audio.click(); });
    };
    bindSwitch('set-particles', 'particles');
    bindSwitch('set-shake', 'shake');
    bindSwitch('set-motion', 'reducedMotion');
    bindSwitch('set-tips', 'tips', on => { if (on) progress.resetTips(); });

    let armed = null;
    $('#reset-archive').addEventListener('click', e => {
        const btn = e.currentTarget;
        if (!armed) {
            btn.textContent = 'Click again to erase';
            armed = setTimeout(() => { btn.textContent = 'Reset archive'; armed = null; }, 4000);
            return;
        }
        clearTimeout(armed);
        armed = null;
        progress.reset();
        btn.textContent = 'Reset archive';
        refreshMenu();
        toast('Archive and records erased.', { icon: 'archive' });
    });
}

export { openArchive, openLeaderboard, openSetup, shareText, announce, RANKS };
