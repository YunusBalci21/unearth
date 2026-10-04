// ============================================
// UNEARTH v1.0.1 — entry point
// ============================================

import { VERSION } from './shared/rules.js';
import { SITES, getSite } from './shared/countries.js';
import { CATALOG } from './data/catalog.js';
import { $, $$, dialogs, initDialogs, toast } from './ui/dom.js';
import { settings } from './settings.js';
import { progress } from './progress.js';
import { audio } from './audio.js';
import { lobby } from './net/lobby.js';
import { createSite, dig, cellIndex, mulberry32 } from './game/site.js';
import { ExcavationScene } from './game/scene.js';
import { warmStudio } from './game/artifactModels.js';
import { Expedition } from './game/expedition.js';
import { hud } from './ui/hud.js';
import { showRoundResults, showFinal, banner } from './ui/results.js';
import { openInspector } from './ui/inspector.js';
import { openShare } from './share.js';
import { initScreens, showScreen, refreshMenu, openMultiplayer, renderRoom, rememberLeaderboardEntry } from './ui/screens.js';

const bootStatus = text => { const el = $('#boot-status'); if (el) el.textContent = text; };

const app = {
    scene: null,
    expedition: null,
    lastSoloConfig: null,

    startSolo(config) {
        this.lastSoloConfig = config;
        showScreen(null);
        dialogs.close('setup');
        this.expedition.startSolo(config);
    },

    toMenu() {
        this.expedition.exit();
        showScreen('menu');
        this.loadDemoSite();
        this.scene.setMode('menu');
        audio.playMusic('menu');
        refreshMenu();
    },

    loadDemoSite() {
        const site = SITES[Math.floor(Math.random() * SITES.length)];
        const demo = createSite({ country: site.name, pool: CATALOG[site.name], seed: Math.floor(Math.random() * 1e9) });
        const r = mulberry32(demo.seed);
        // A half-excavated trench so the stratigraphy shows behind the menu
        for (let z = 1; z <= 4; z++) for (let x = 3; x <= 6; x++) {
            const target = 1 + Math.floor(r() * 3);
            for (let k = 0; k < target; k++) dig(demo, cellIndex(x, z), 'trowel');
        }
        for (let z = 5; z <= 6; z++) for (let x = 4; x <= 5; x++) dig(demo, cellIndex(x, z), 'trowel');
        this.scene.loadSite(demo, site);
    },
};

function applySettings() {
    document.body.classList.toggle('reduce-motion', !!settings.get('reducedMotion'));
    if (app.scene) {
        app.scene.reducedMotion = !!settings.get('reducedMotion');
        app.scene.shakeEnabled = !!settings.get('shake');
        app.scene.effects?.setEnabled(!!settings.get('particles'));
    }
}

async function submitScore(run) {
    const eligible = run.score > 0 && (run.mode === 'daily' || (run.mode === 'solo' && run.region === 'world'));
    if (!eligible) return null;
    try {
        const res = await fetch('/api/leaderboard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: settings.playerName, score: run.score, rounds: run.rounds, correct: run.correct,
                color: settings.get('color'), mode: run.mode,
            }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (data.id) rememberLeaderboardEntry(data.id);
        return data;
    } catch {
        return null;
    }
}

function wireMultiplayer() {
    const exp = () => app.expedition;
    lobby.on('game-starting', msg => {
        dialogs.close('final');
        let n = msg.countdown || 3;
        const tick = () => {
            if (n > 0) { banner(String(n), '', n === 3 ? 'The expedition sets off' : ''); audio.countdown(n); n--; setTimeout(tick, 1000); }
        };
        tick();
        setTimeout(() => {
            showScreen(null);
            exp().startMultiplayer({ rounds: msg.settings.rounds, time: msg.settings.timePerRound, players: msg.players || lobby.lobby?.players || [] });
        }, 600);
    });
    lobby.on('round-start', msg => exp().onServerRoundStart(msg));
    lobby.on('round-go', msg => exp().onServerRoundGo(msg));
    lobby.on('timer', msg => { if (exp().active) exp().syncServerTimer(msg); });
    lobby.on('guessed', msg => exp().onServerGuess(msg));
    lobby.on('scores', standings => exp().onServerScores(standings));
    lobby.on('round-end', msg => exp().onServerRoundEnd(msg));
    lobby.on('game-end', msg => exp().onServerGameEnd(msg));
    lobby.on('lobby', () => { if (exp().active && exp().config?.mode === 'multi') exp().renderStandings(); });

    const kickedOut = reason => {
        if (exp().active && exp().config?.mode === 'multi') {
            dialogs.close('round-results');
            app.toMenu();
        }
        if ($('#room').classList.contains('active') || $('#mp').classList.contains('active')) openMultiplayer();
        toast(reason, { type: 'bad', duration: 5000 });
    };
    lobby.on('removed', kickedOut);
    lobby.on('disconnected', () => kickedOut('Lost connection to the expedition server.'));
    lobby.on('broadcast', message => {
        audio.notify();
        toast(`Message from the Unearth team: ${message}`, { type: 'gold', icon: 'info', duration: 9000 });
    });
    lobby.on('banned', msg => {
        const boot = $('#boot');
        boot.classList.remove('done');
        $('#boot-status').textContent = 'Access suspended';
        const err = $('#boot-error');
        err.hidden = false;
        err.textContent = `${msg.reason || 'You have been banned from this server.'} ${msg.expiresAt ? `Ban expires ${new Date(msg.expiresAt).toLocaleString()}.` : ''}`;
        app.expedition?.exit();
    });
}

async function enableDebug(key) {
    try {
        const res = await fetch('/api/admin/verify', { headers: { 'x-admin-key': key } });
        if (!res.ok) return;
    } catch { return; }
    window.__unearth = {
        app,
        get site() { return app.expedition.site; },
        xray() {
            for (const obj of app.scene.findObjects.values()) { obj.holder.visible = true; }
            return app.expedition.site?.finds.map(f => ({ id: f.entry.id, cell: f.cell, layer: f.layer, state: f.state }));
        },
        country() { return app.expedition.site?.country; },
    };
    toast('Debug mode — window.__unearth is available', { icon: 'settings', duration: 5000 });
}

async function boot() {
    $$('[data-version]').forEach(el => { el.textContent = VERSION; });
    initDialogs();
    applySettings();
    settings.onChange(key => { if (['reducedMotion', 'shake', 'particles'].includes(key)) applySettings(); });

    bootStatus('Surveying the site…');
    const scene = new ExcavationScene($('#scene'));
    app.scene = scene;
    try {
        await scene.init();
    } catch (err) {
        console.error('[Unearth] 3D initialisation failed', err);
        $('#boot-error').hidden = false;
        bootStatus('3D graphics unavailable');
        return;
    }
    applySettings();

    app.expedition = new Expedition(scene, {
        roundResults: opts => showRoundResults(opts),
        final: run => showFinal(run, {
            onShare: r => openShare(r),
            onMenu: () => app.toMenu(),
            onAgain: run.mode === 'multi'
                ? () => { app.toMenu(); if (lobby.lobby) { showScreen('room'); renderRoom(); } else openMultiplayer(); }
                : run.mode === 'daily' ? null : () => app.startSolo(app.lastSoloConfig),
            submitScore: () => submitScore(run),
        }),
        inspect: (entry, opts) => openInspector(entry, opts),
    });

    initScreens(app);
    wireMultiplayer();

    // Pause menu: abandon with an inline confirmation
    const confirmBox = $('#pause-confirm'), quitBtn = $('#pause-quit');
    quitBtn.addEventListener('click', () => { audio.click(); confirmBox.hidden = false; quitBtn.hidden = true; $('#pause-quit-cancel').focus(); });
    $('#pause-quit-cancel').addEventListener('click', () => { audio.click(); confirmBox.hidden = true; quitBtn.hidden = false; quitBtn.focus(); });
    $('#pause-quit-confirm').addEventListener('click', () => {
        audio.click();
        const multi = app.expedition.config?.mode === 'multi';
        dialogs.close('pause');
        if (multi) lobby.leave();
        app.toMenu();
        if (multi) openMultiplayer();
    });
    lobby.open(); // background connection: admin broadcasts and quick multiplayer

    app.loadDemoSite();
    scene.setMode('menu');
    showScreen('menu', { focus: false });
    audio.playMusic('menu');

    $('#boot').classList.add('done');
    window.__unearthReady = true;
    setTimeout(() => warmStudio(), 1500);
    clearTimeout(window.__unearthBootTimer);

    const params = new URLSearchParams(location.search);
    const join = params.get('join');
    if (join && /^[A-Z0-9]{4,8}$/i.test(join)) {
        openMultiplayer(join.toUpperCase());
        history.replaceState(null, '', location.pathname);
    }
    const debugKey = params.get('debug');
    if (debugKey) {
        history.replaceState(null, '', location.pathname); // keep the key out of history
        enableDebug(debugKey);
    }

    if (!progress.uniqueCount && !progress.stats.expeditions && !localStorage.getItem('unearth_seen_guide')) {
        try { localStorage.setItem('unearth_seen_guide', '1'); } catch { /* ignore */ }
    }
}

// Pause solo play when the tab is hidden so the clock doesn't run away.
document.addEventListener('visibilitychange', () => {
    const exp = app.expedition;
    if (document.hidden && exp?.active && exp.config?.mode !== 'multi' && !dialogs.anyOpen()) exp.openPause();
});

window.addEventListener('error', e => {
    console.error('[Unearth]', e.error || e.message);
});
window.addEventListener('unhandledrejection', e => {
    console.error('[Unearth] unhandled', e.reason);
});

// Keep HUD tooltip from lingering over dialogs
document.addEventListener('dialogs:change', () => {
    const open = dialogs.anyOpen();
    document.body.classList.toggle('has-dialog', open);
    if (open) hud.gauge(null);
});

boot();

export { app, getSite };
