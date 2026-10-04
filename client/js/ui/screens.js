// ============================================
// SCREENS — base camp, expedition order (setup), expedition board
// (multiplayer), the Archive catalogue, the leaderboard register and settings.
// ============================================

import { $, $$, h, clear, icon, iconSrc, fmtInt, fmtTime, dialogs, toast, segmented, swatches, copyText, announce } from './dom.js';
import { settings, PLAYER_COLORS } from '../settings.js';
import { progress, RANKS } from '../progress.js';
import { audio } from '../audio.js';
import { lobby } from '../net/lobby.js';
import { REGIONS, SITES, sitesInRegion } from '../shared/countries.js';
import { ROUND_OPTIONS, TIME_OPTIONS, MAX_PLAYER_OPTIONS } from '../shared/rules.js';
import { CATALOG, ALL_ARTIFACTS, RARITIES, formatYear, materialLabel } from '../data/catalog.js';
import { CONDITIONS } from '../game/site.js';
import { artifactThumbnail } from '../game/artifactModels.js';
import { dailyNumber } from '../game/expedition.js';
import { openInspector } from './inspector.js';
import { catalogNumber } from './catalogue.js';
import { shareText, openShare } from '../share.js';

const timeLabel = t => (t === 0 ? '∞' : fmtTime(t));
const TIME_SEG = TIME_OPTIONS.filter(t => t !== 0).concat(0).map(t => ({ value: t, label: timeLabel(t), sub: t === 0 ? 'Relaxed' : t <= 60 ? 'Blitz' : t >= 180 ? 'Patient' : null }));
const ROUND_SEG = [3, 5, 10, 15].map(r => ({ value: r, label: String(r), sub: { 3: 'Quick', 5: 'Classic', 10: 'Long', 15: 'Epic' }[r] }));
const REGION_SEG = Object.values(REGIONS).map(r => ({ value: r.id, label: r.id === 'africa-me' ? 'Africa & M. East' : r.id === 'americas' ? 'Americas & Oceania' : r.label }));

let app = null;

export function showScreen(id, { focus = true } = {}) {
    for (const el of $$('.screen')) el.classList.toggle('active', el.id === id);
    document.body.classList.toggle('in-menu', !!id);
    const target = id && document.getElementById(id);
    if (target && focus) {
        // Priority order, not document order: the primary action beats header icons
        const focusable = ['[autofocus]', '.menu-item.lead', '.btn-primary', 'input', 'button']
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
    // A quiet tick when the pointer moves between menu entries.
    document.addEventListener('pointerover', e => {
        const item = e.target.closest?.('.menu-item');
        if (item && !item.contains(e.relatedTarget)) audio.hover();
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
    'toggle-sound': () => {
        const muted = audio.toggleMute();
        updateSoundButtons();
        toast(muted ? 'Sound off' : 'Sound on', { icon: muted ? 'mute' : 'sound' });
    },
    'back-to-menu': () => { showScreen('menu'); },
    'leave-lobby': () => { lobby.leave(); openMultiplayer(); },
};

export function updateSoundButtons() {
    const muted = settings.get('muted');
    for (const btn of $$('[data-action="toggle-sound"]')) {
        btn.setAttribute('aria-pressed', String(muted));
        btn.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
        btn.querySelector('img').src = iconSrc(muted ? 'mute' : 'sound');
    }
}

// ---------- Base camp ----------

export function refreshMenu() {
    const rank = progress.rank();
    $('#rank-seal').textContent = rank.seal;
    $('#rank-name').textContent = rank.name;
    $('#rank-bar').style.setProperty('--value', rank.progress);
    const unseen = progress.unseenCount;
    $('#rank-sub').textContent = rank.next ? `${rank.count} catalogued · ${rank.next.min - rank.count} to ${rank.next.name}` : `${rank.count} catalogued · highest rank`;
    $('#archive-meta').textContent = `${rank.count} / ${ALL_ARTIFACTS.length}${unseen ? ` · ${unseen} new` : ''}`;
    const day = dailyNumber();
    const done = progress.dailyResult(day);
    $('#daily-meta').textContent = done ? `#${day} · done · ${fmtInt(done.score)}` : `#${day} · 5 sites`;
    updateSoundButtons();
}

// ---------- Solo setup: the expedition order ----------

let setupState = null;

function initSetup() {
    const last = settings.get('lastSolo') || {};
    setupState = { region: last.region || 'world', rounds: last.rounds || 5, time: last.time ?? 120 };
    const updateNote = () => {
        $('#setup-note').textContent = setupState.region === 'world'
            ? 'Worldwide expeditions are entered in the worldwide leaderboard.'
            : `${sitesInRegion(setupState.region).length} possible sites. Regional expeditions are not entered in the leaderboard.`;
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
    $('#setup-no').textContent = `No. ${String((progress.stats.expeditions || 0) + 1).padStart(4, '0')}`;
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

// ---------- Expedition board (multiplayer) ----------

const mpState = { rounds: 5, time: 120, players: 6 };

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
        lobby.create({
            hostName: currentName(),
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
        const light = $('#mp-status');
        light.className = `status-light ${s === 'online' ? 'ok' : s === 'offline' ? 'bad' : ''}`;
        light.textContent = s === 'online' ? 'Radio online' : s === 'offline' ? 'Offline — retrying' : 'Connecting…';
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
        host.append(h('div.empty', icon('globe'), h('span', 'The expedition server is unreachable.'),
            h('button.btn.btn-sm', { type: 'button', onclick: () => openMultiplayer() }, icon('refresh'), 'Try again')));
        return;
    }
    if (!list.length) {
        host.append(h('div.empty', icon('users'), h('span', 'No open expeditions right now.'), h('span.empty-kicker', 'Host one and share the code')));
        return;
    }
    for (const l of list) {
        host.append(h('div.lobby-item',
            h('div.meta',
                h('strong', l.name),
                h('span', `${l.playerCount}/${l.maxPlayers} explorers · ${l.rounds} sites · ${timeLabel(l.timePerRound ?? 120)}`)),
            l.hasPassword ? icon('lock') : h('span'),
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
    $('#prompt-text').textContent = `Expedition ${code} is restricted to its team.`;
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
        team.append(h('li',
            h('span.dot', { style: { '--c': p.color } }),
            h('span', p.name, me ? h('span.you', ' — you') : null),
            p.id === l.hostId ? h('span.host', icon('crown', 'keep'), 'Leader') : h('span'),
            lobby.isHost && !me ? h('button.kick', { type: 'button', 'aria-label': `Remove ${p.name}`, title: 'Remove from the team', onclick: () => lobby.kick(p.id) }, icon('x', 'keep')) : h('span'),
            lobby.isHost && !me ? h('button.kick', { type: 'button', 'aria-label': `Ban ${p.name}`, title: 'Ban from this expedition', onclick: () => lobby.ban(p.id) }, icon('ban', 'keep')) : h('span')));
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
    clear($('#room-start')).append(icon('play'), l.players.length > 1 ? 'Set off' : 'Set off alone');
}

// ---------- The Archive: a catalogue with an index and entries ----------

let archiveCountry = null;

function openArchive(country = null) {
    archiveCountry = country || archiveCountry || firstCountryWithFinds();
    renderArchive();
    dialogs.open('archive', { onClose: () => refreshMenu() });
}

function firstCountryWithFinds() {
    const names = SITES.map(s => s.name).sort((a, b) => a.localeCompare(b));
    return names.find(n => CATALOG[n].some(a => progress.entry(a.id)?.unseen))
        || names.find(n => progress.countryProgress(n).found > 0)
        || names[0];
}

function renderArchive({ showEntries = false } = {}) {
    const root = $('#archive .archive');
    const body = clear($('#archive-body'));
    const rank = progress.rank();
    const legendary = Object.keys(progress.data.finds).filter(id => ALL_ARTIFACTS.find(a => a.id === id)?.rarity === 'legendary').length;
    $('#archive-count').textContent = `${rank.count} / ${ALL_ARTIFACTS.length}`;

    body.append(h('div.arch-summary',
        h('span.seal', rank.seal),
        h('div.rank',
            h('strong', rank.name),
            h('span.ruler', { style: { '--value': rank.progress } }, h('span')),
            h('small', { style: { font: '400 12px var(--f-mono)', color: 'var(--ink-3)' } }, rank.next ? `${rank.next.min - rank.count} more to ${rank.next.name}` : 'Highest rank reached')),
        h('div.fig', h('b', `${legendary}/${SITES.length}`), h('span', 'Legendary')),
        h('div.fig', h('b', fmtInt(progress.totalValue())), h('span', 'Museum value'))));

    const index = h('nav.arch-index', { 'aria-label': 'Countries' });
    for (const region of Object.values(REGIONS).filter(r => r.id !== 'world')) {
        index.append(h('h4.arch-region', region.label));
        for (const site of sitesInRegion(region.id).sort((a, b) => a.name.localeCompare(b.name))) {
            const list = CATALOG[site.name];
            const prog = progress.countryProgress(site.name);
            const fresh = list.some(a => progress.entry(a.id)?.unseen);
            index.append(h('button.arch-country', {
                type: 'button', class: prog.found === prog.total ? 'complete' : '',
                'aria-current': String(site.name === archiveCountry),
                onclick: () => { archiveCountry = site.name; renderArchive({ showEntries: true }); },
            },
            h('span.n', site.name, fresh ? h('i.newdot', { title: 'New finds' }) : null),
            h('span.pips', { 'aria-hidden': 'true' }, ...list.map(a => h('i', { class: `${progress.has(a.id) ? 'on' : ''} ${a.rarity === 'legendary' ? 'legendary' : ''}` }))),
            h('span.c', `${prog.found}/${prog.total}`)));
        }
    }

    const entries = h('section.arch-entries', { 'aria-label': `${archiveCountry} entries` });
    renderCountry(entries, archiveCountry);
    body.append(h('div.arch-grid', index, entries));
    root.classList.toggle('show-entries', showEntries);
    requestAnimationFrame(() => index.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' }));
}

function renderCountry(host, country) {
    const prog = progress.countryProgress(country);
    host.append(
        h('button.btn.btn-sm.arch-back', { type: 'button', onclick: () => renderArchive({ showEntries: false }) }, icon('back'), 'All countries'),
        h('div.arch-entries-head', h('h3', country), h('span', `${prog.found} of ${prog.total} catalogued`)));
    if (rankEmpty()) host.append(h('p.dim-line', 'Your archive is empty. Every artifact you recover in the field is catalogued here.'));
    for (const entry of CATALOG[country]) {
        const rec = progress.entry(entry.id);
        const img = h('img', { alt: '' });
        artifactThumbnail(entry).then(url => { if (url) img.src = url; }).catch(() => {});
        if (rec) {
            host.append(h('button.entry-row', {
                type: 'button',
                onclick: () => {
                    progress.markSeen(entry.id);
                    openInspector(entry, { revealed: true, condition: rec.best, onClose: () => renderArchive({ showEntries: true }) });
                },
            },
            h('span.cno', catalogNumber(entry).replace('Cat. ', '')),
            h('span.thumb', img),
            h('span.t', h('strong', entry.name), h('small', `${materialLabel(entry)} · ${formatYear(entry.year)} · ${CONDITIONS[rec.best].label} · ×${rec.count}`)),
            h('span.side',
                h('span', { class: `rarity rarity-${entry.rarity}` }, RARITIES[entry.rarity].label),
                rec.unseen ? h('span.tag.new', 'New') : null)));
        } else {
            host.append(h('div.entry-row.locked',
                h('span.cno', catalogNumber(entry).replace('Cat. ', '')),
                h('span.thumb', img),
                h('span.t', h('strong', 'Not yet recovered'), h('small', 'Still in the ground')),
                h('span.side', h('span', { class: `rarity rarity-${entry.rarity}` }, RARITIES[entry.rarity].label))));
        }
    }
}

const rankEmpty = () => progress.uniqueCount === 0;

// ---------- Leaderboard: the register ----------

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
    for (let i = 0; i < 6; i++) body.append(h('div.skeleton', { style: { height: '42px', marginBottom: '4px' } }));
    let data;
    try {
        const res = await fetch('/api/leaderboard', { cache: 'no-store' });
        if (!res.ok) throw new Error(res.status);
        data = await res.json();
    } catch {
        clear(body).append(h('div.empty', icon('globe'), h('span', 'Couldn’t reach the register.'),
            h('button.btn.btn-sm', { type: 'button', onclick: () => openLeaderboard() }, icon('refresh'), 'Retry')));
        return;
    }
    clear(body);
    let mine = new Set();
    try { mine = new Set(JSON.parse(localStorage.getItem(MY_ENTRIES_KEY) || '[]')); } catch { /* ignore */ }
    body.append(h('p.register-note', progress.stats.bestScore > 0
        ? `Your best expedition: ${fmtInt(progress.stats.bestScore)} points. Worldwide solo expeditions and Daily Digs are entered here.`
        : 'Worldwide solo expeditions and Daily Digs are entered here.'));
    if (!data.length) {
        body.append(h('div.empty', icon('trophy'), h('span', 'No entries yet — set off on a worldwide expedition to claim the first line.')));
        return;
    }
    const list = h('div.register');
    data.forEach((e, i) => {
        const date = e.date ? new Date(e.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
        list.append(h('div.reg-row', { class: mine.has(e.id) ? 'me' : '' },
            h('span.rk', i < 3 ? ['I', 'II', 'III'][i] : String(i + 1)),
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
        const sync = () => { out.textContent = `${input.value}%`; input.style.setProperty('--p', `${input.value}%`); };
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
