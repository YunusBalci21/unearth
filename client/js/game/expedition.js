// ============================================
// EXPEDITION — the game controller.
// Connects player input → site logic → scene feedback → HUD, and runs the
// solo, Daily Dig and multiplayer round flows.
// ============================================

import {
    createSite, dig, brush, probe, findAt, toolFootprint, recoveredCount, LAYERS, LAYER_NAMES,
    cellLabel, cellIndex, cellX, cellZ, GRID, sherdVisible, stainVisible, displayName, hashString,
    mulberry32, shuffle,
} from './site.js';
import { CATALOG, RARITIES, ALL_ARTIFACTS } from '../data/catalog.js';
import { SITES, sitesInRegion, getSite, REGIONS } from '../shared/countries.js';
import { basePoints, timeBonus, pointsForCorrect, WRONG_GUESS_PENALTY } from '../shared/rules.js';
import { hud, SOIL_LABEL } from '../ui/hud.js';
import { showFindRecord, dismissFindRecord, LAYER_DEPTH_M } from '../ui/reveal.js';
import { audio } from '../audio.js';
import { progress } from '../progress.js';
import { settings } from '../settings.js';
import { artifactThumbnail } from './artifactModels.js';
import { toast, announce, dialogs, h, $, isTouch, icon } from '../ui/dom.js';
import { lobby } from '../net/lobby.js';

export const TIPS = [
    'Deeper layers are older — and hold the rarest finds.',
    'Potsherds on the surface usually lie close to something buried.',
    'A dark stain in the soil marks a find one layer further down.',
    'The trowel never damages a find. The shovel is four times faster.',
    'Guessing early with one find is worth 500 points — five finds only 100.',
    'A survey probe counts every hidden find in the 3×3 units around it.',
    'Badly chipped finds can’t be identified by name — dig carefully near clues.',
    'Every artifact you recover is catalogued in your Archive.',
    'Right-drag or use Q / E to walk around the trench. R resets the view.',
    'Wrong guesses cost 100 points. When in doubt, recover one more find.',
    'The Daily Dig is the same five sites for everyone — compare scores with friends.',
    'Machu Picchu’s finest walls were fitted without mortar.',
    'The Library of Alexandria may have held hundreds of thousands of scrolls.',
    'Angkor Wat is the largest religious monument in the world.',
    'Pompeii was buried under metres of volcanic ash in AD 79.',
];

export function dailyNumber(date = new Date()) {
    const epoch = Date.UTC(2026, 0, 1);
    const day = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    return Math.floor((day - epoch) / 86400000) + 1;
}

export function dailyPlan(day) {
    const rng = mulberry32(hashString(`unearth-daily-${day}`));
    const countries = shuffle(SITES.map(s => s.name), rng).slice(0, 5);
    return { countries, seeds: countries.map(() => Math.floor(rng() * 2 ** 31)) };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const compactLayout = () => innerWidth <= 720 || (innerHeight <= 520 && innerWidth <= 940);

const COACH = {
    dig: { step: 1, html: 'Click a unit of the grid to dig with the <b>shovel</b>. Right-drag (or drag with one finger) to look around.' },
    brush: { step: 2, html: 'Something is showing through the soil! Choose the <kbd>3</kbd> brush and clean it to lift it out.' },
    guess: { step: 3, html: 'Every find is a clue — but each extra one lowers your score. Name the country below whenever you’re ready.' },
    careful: { step: '!', html: 'The shovel chipped that find. Near potsherds and stains, switch to the <kbd>2</kbd> trowel.' },
    probe: { step: 4, html: 'Not sure where to dig? A <kbd>4</kbd> probe counts the finds hidden in the 3×3 units around it.' },
};

export class Expedition {
    constructor(scene, ui) {
        this.scene = scene;
        this.ui = ui;
        this.active = false;
        this.tool = 'shovel';
        this.thumbs = new Map();
        this.hoverCell = null;
        this.cursor = null;
        this.busy = false;
        this.queued = null;
        this.paused = false;
        this.timerHandle = null;
        this.coachKey = null;
        this.bindInput();
        hud.init({
            onTool: t => this.setTool(t, true),
            onGuess: c => this.guess(c),
            onPause: () => this.openPause(),
            onInspect: f => this.inspect(f),
            onFocusFind: f => this.scene.focusCell(f.cell),
            onCoachClose: () => { settings.set('tips', false); hud.hideCoach(); },
        });
    }

    // ============ lifecycle ============

    /** Solo or daily expedition. config: { mode, rounds, time, region } */
    startSolo(config) {
        const daily = config.mode === 'daily';
        let countries, seeds;
        if (daily) {
            ({ countries, seeds } = dailyPlan(config.daily));
        } else {
            const pool = sitesInRegion(config.region).map(s => s.name);
            countries = [];
            while (countries.length < config.rounds) countries.push(...shuffle(pool, Math.random));
            countries = countries.slice(0, config.rounds);
            seeds = countries.map(() => Math.floor(Math.random() * 2 ** 31));
        }
        this.begin({ ...config, countries, seeds, rounds: countries.length });
        this.loadRound(0);
    }

    /** Multiplayer: the server drives rounds; we just reset local state. */
    startMultiplayer({ rounds, time, players }) {
        this.begin({ mode: 'multi', rounds, time, region: 'world', players });
        hud.setStandings(players.map(p => ({ ...p, score: 0 })), lobby.playerId);
    }

    begin(config) {
        this.config = config;
        this.active = true;
        this.round = -1;
        this.score = 0;
        this.streak = 0;
        this.bestStreak = 0;
        this.log = [];
        this.runFinds = 0;
        this.guessedIds = new Set();
        hud.setScore(0);
        hud.show(true);
        this.scene.setMode('play');
        document.body.classList.remove('in-menu');
        document.body.classList.toggle('multiplayer', config.mode === 'multi');
        if (config.mode !== 'multi') hud.setStandings(null);
        audio.playMusic('game');
        this.setTool('shovel');
    }

    loadRound(index, server = null) {
        this.stopTimer();
        this.round = index;
        const country = server ? server.country : this.config.countries[index];
        const seed = server ? server.seed : this.config.seeds[index];
        const def = getSite(country);
        this.site = createSite({ country, pool: CATALOG[country], seed });
        this.siteDef = def;
        this.roundOver = false;
        this.guessed = null;
        this.startedAt = 0;
        this.guessedIds = new Set();
        this.damagedThisSite = false;
        dismissFindRecord();
        this.revealing = false;
        this.paused = false;
        document.body.classList.remove('revealing', 'revealing-solo');
        this.scene.loadSite(this.site, def);
        this.scene.resetView(false);
        this.setTool('shovel');
        hud.setSite({ index: index + 1, total: this.config.rounds, soil: def.soil, modeLabel: this.modeLabel() });
        hud.setSoil(this.scene.soilColors);
        hud.gauge(null);
        hud.setProbes(this.site.probesLeft);
        hud.renderFinds(this.site, this.thumbs);
        hud.resetGuess();
        hud.setTimer(this.config.time, this.config.time);
        this.remaining = this.config.time;
        this.updatePotential();
        dialogs.close('round-results');

        const intro = () => {
            if (this.config.mode === 'multi') {
                hud.setGuessEnabled(false);
                lobby.ready(server.round);
            } else {
                this.startTimer(this.config.time);
            }
            this.maybeCoach(index === 0 ? 'dig' : index === 1 && this.site.probesLeft === 3 ? 'probe' : null);
        };
        this.showIntro(index, intro);
    }

    modeLabel() {
        if (!this.config) return '';
        if (this.config.mode === 'daily') return `Daily Dig #${this.config.daily}`;
        if (this.config.mode === 'multi') return 'Multiplayer';
        return REGIONS[this.config.region]?.label || 'Worldwide';
    }

    showIntro(index, done) {
        const el = $('#site-intro');
        $('#intro-kicker').textContent = `Site ${String(index + 1).padStart(2, '0')} / ${String(this.config.rounds).padStart(2, '0')}`;
        $('#intro-title').textContent = index === 0 ? 'Breaking ground' : 'A new excavation';
        const facts = $('#intro-facts');
        facts.textContent = '';
        const soil = SOIL_LABEL[this.siteDef.soil];
        facts.append(
            factEl('layers', soil),
            factEl('pot', `${this.site.finds.length} finds buried`),
            factEl('probe', `${this.site.probesLeft} probes`),
            factEl('clock', this.config.time ? `${Math.round(this.config.time / 60 * 10) / 10} min` : 'No time limit'),
        );
        $('#intro-tip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
        const bar = $('#intro-bar');
        bar.style.transition = 'none';
        bar.style.width = '0%';
        el.classList.add('show');
        requestAnimationFrame(() => {
            bar.style.transition = 'width 1500ms linear';
            bar.style.width = '100%';
        });
        let finished = false;
        const finish = () => {
            if (finished) return;
            finished = true;
            el.classList.remove('show');
            el.removeEventListener('pointerdown', finish);
            done();
        };
        el.addEventListener('pointerdown', finish);
        setTimeout(finish, settings.get('reducedMotion') ? 700 : 1600);
    }

    exit() {
        this.active = false;
        dismissFindRecord();
        this.revealing = false;
        document.body.classList.remove('revealing', 'revealing-solo');
        this.stopTimer();
        this.paused = false;
        audio.setUrgent(false);
        hud.show(false);
        hud.setStandings(null);
        this.scene.setHover(null);
        this.scene.setCursor(null);
        dialogs.close('round-results');
        dialogs.close('pause');
        document.body.classList.remove('multiplayer');
    }

    // ============ timer ============

    startTimer(seconds) {
        this.stopTimer();
        this.startedAt = performance.now();
        if (!seconds) { hud.setTimer(0, 0); this.remaining = 0; return; }
        this.deadline = performance.now() + seconds * 1000;
        audio.resetCountdown();
        audio.setUrgent(false);
        this.tick();
        this.timerHandle = setInterval(() => this.tick(), 200);
    }

    /** Multiplayer: anchor to the server clock. */
    syncServerTimer(msg) {
        if (!msg.timePerRound) { this.stopTimer(); hud.setTimer(0, 0); this.remaining = 0; return; }
        const offset = Date.now() - msg.serverTime;
        const endsAtLocal = msg.roundStartTime + msg.timePerRound * 1000 + offset;
        this.deadline = performance.now() + (endsAtLocal - Date.now());
        if (!this.timerHandle) {
            audio.resetCountdown();
            this.timerHandle = setInterval(() => this.tick(), 200);
        }
        this.tick();
    }

    tick() {
        if (this.paused || !this.deadline) return;
        const remaining = Math.max(0, (this.deadline - performance.now()) / 1000);
        this.remaining = remaining;
        hud.setTimer(remaining, this.config.time);
        const whole = Math.ceil(remaining);
        if (whole <= 10 && !this.roundOver && !this.guessed) audio.countdown(whole);
        audio.setUrgent(whole <= 10 && !this.roundOver);
        this.updatePotential();
        if (remaining <= 0) {
            this.stopTimer();
            this.timeUp();
        }
    }

    stopTimer() {
        clearInterval(this.timerHandle);
        this.timerHandle = null;
        audio.setUrgent(false);
    }

    pause() {
        if (this.config?.mode === 'multi' || this.paused) return;
        this.paused = true;
        this.pausedLeft = this.deadline ? this.deadline - performance.now() : 0;
    }

    resume() {
        if (!this.paused) return;
        this.paused = false;
        if (this.deadline && !this.roundOver) this.deadline = performance.now() + this.pausedLeft;
    }

    openPause() {
        if (!this.active || dialogs.anyOpen()) return;
        const multi = this.config.mode === 'multi';
        $('#pause-kicker').textContent = multi ? 'The clock keeps running in multiplayer' : 'Expedition paused';
        $('#pause-confirm').hidden = true;
        $('#pause-quit').hidden = false;
        this.pause();
        audio.click();
        dialogs.open('pause', { onClose: () => this.resume() });
    }

    updatePotential() {
        if (!this.site) return;
        const base = basePoints(recoveredCount(this.site));
        const bonus = this.config?.time ? timeBonus(this.remaining) : 0;
        hud.setPotential(base, bonus);
    }

    // ============ input ============

    bindInput() {
        const canvas = this.scene.canvas;
        let down = null;
        let lastMove = 0;

        canvas.addEventListener('pointermove', e => {
            if (!this.canPlay() || e.pointerType === 'touch') return;
            const now = performance.now();
            if (now - lastMove < 30) return;
            lastMove = now;
            this.updateHover(e.clientX, e.clientY);
        });
        canvas.addEventListener('pointerleave', () => { this.hoverCell = null; this.scene.setHover(null); hud.gauge(null); });
        canvas.addEventListener('pointerdown', e => {
            if (!this.canPlay()) return;
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, touches: e.isPrimary ? 1 : 2 };
        });
        canvas.addEventListener('pointerup', e => {
            if (!down || e.pointerId !== down.id) return;
            const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
            const quick = performance.now() - down.t < (e.pointerType === 'touch' ? 380 : 800);
            down = null;
            if (!this.canPlay() || moved > (e.pointerType === 'touch' ? 12 : 6) || !quick) return;
            const pick = this.scene.pick(e.clientX, e.clientY);
            if (!pick) return;
            this.setKeyboardCursor(null);
            this.act(pick.cell);
            if (e.pointerType !== 'touch') this.updateHover(e.clientX, e.clientY);
        });
        canvas.addEventListener('pointercancel', () => { down = null; });
        canvas.addEventListener('contextmenu', e => e.preventDefault());

        document.addEventListener('keydown', e => this.onKey(e));
    }

    canPlay() {
        return this.active && !this.paused && !this.revealing && !dialogs.anyOpen() && !this.roundOver && !!this.site
            && !$('#site-intro').classList.contains('show');
    }

    onKey(e) {
        if (!this.active) return;
        if (e.target.closest?.('input, textarea, select, dialog')) return;
        if (e.key === 'Escape') {
            if (!dialogs.anyOpen()) { e.preventDefault(); this.openPause(); }
            return;
        }
        if (!this.canPlay() || e.metaKey || e.ctrlKey || e.altKey) return;
        const tools = { 1: 'shovel', 2: 'trowel', 3: 'brush', 4: 'probe' };
        if (tools[e.key]) { e.preventDefault(); this.setTool(tools[e.key], true); return; }
        const key = e.key.toLowerCase();
        if (key === 'r') { this.scene.resetView(); return; }
        if (key === 'q') { this.scene.rotateView(-Math.PI / 4); return; }
        if (key === 'e') { this.scene.rotateView(Math.PI / 4); return; }
        if (key === '/' || key === 'g') { e.preventDefault(); hud.focusGuess(); return; }
        const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
        if (arrows[e.key]) {
            e.preventDefault();
            const cur = this.cursor ?? this.hoverCell ?? cellIndex(3, 3);
            const [dx, dz] = arrows[e.key];
            const x = Math.max(0, Math.min(GRID - 1, cellX(cur) + dx));
            const z = Math.max(0, Math.min(GRID - 1, cellZ(cur) + dz));
            this.setKeyboardCursor(cellIndex(x, z));
            return;
        }
        if ((e.key === 'Enter' || e.key === ' ') && this.cursor != null) {
            e.preventDefault();
            this.act(this.cursor);
        }
    }

    setKeyboardCursor(cell) {
        this.cursor = cell;
        this.scene.setCursor(cell);
        if (cell != null) {
            this.hoverCell = cell;
            this.refreshHover();
            const info = this.describeCell(cell);
            hud.gauge(info);
            announce(`${info.unit}. ${info.layer}. ${info.notes.map(n => n.text).join('. ')}`);
        }
    }

    updateHover(x, y) {
        const pick = this.scene.pick(x, y);
        const cell = pick ? pick.cell : null;
        this.hoverCell = cell;
        this.refreshHover();
        hud.gauge(cell == null ? null : this.describeCell(cell));
    }

    refreshHover() {
        const cell = this.hoverCell;
        if (cell == null || !this.site) { this.scene.setHover(null); this.scene.highlightFind(null); hud.setCursor(null); return; }
        const find = findAt(this.site, cell);
        let tool = this.tool;
        if (find?.state === 'exposed' && tool !== 'probe') tool = 'brush';
        const fp = toolFootprint(tool, cell);
        let blocked = false;
        if (tool === 'brush') blocked = !(find && find.state === 'exposed');
        else if (tool === 'probe') blocked = this.site.probesLeft <= 0 || this.site.probes.has(cell);
        else blocked = fp.every(c => this.site.depth[c] >= LAYERS || findAt(this.site, c)?.state === 'exposed');
        this.scene.setHover(cell, tool, fp, blocked);
        this.scene.highlightFind(find?.state === 'exposed' ? find : null);
        hud.setCursor(tool, blocked);
    }

    /** What the depth gauge says about a unit, for the current tool. */
    describeCell(cell) {
        const site = this.site;
        const d = site.depth[cell];
        const find = findAt(site, cell);
        const notes = [];
        const exposed = find?.state === 'exposed';
        if (exposed) notes.push({ text: `Find exposed — brush it clean (${find.cleaned}/${find.strokesNeeded})`, kind: 'clue' });
        else if (this.tool === 'shovel') {
            const nearExposed = toolFootprint('shovel', cell).some(c => findAt(site, c)?.state === 'exposed');
            if (d >= LAYERS) notes.push({ text: 'Bedrock — nothing deeper here' });
            else notes.push(nearExposed ? { text: 'Shovel works around exposed finds' } : { text: 'Shovel may chip what it uncovers', kind: 'warn' });
        } else if (this.tool === 'trowel') notes.push({ text: d >= LAYERS ? 'Bedrock — nothing deeper here' : 'Trowel: safe for finds' });
        else if (this.tool === 'brush') notes.push({ text: 'Nothing exposed here yet — dig first', kind: 'warn' });
        else if (this.tool === 'probe') {
            notes.push(site.probes.has(cell) ? { text: `Already surveyed: ${site.probes.get(cell)} nearby` }
                : site.probesLeft > 0 ? { text: `Survey the 3×3 area · ${site.probesLeft} left` } : { text: 'No probes left at this site', kind: 'warn' });
        }
        if (sherdVisible(site, cell)) notes.push({ text: 'Potsherd on the surface — a find may be close', kind: 'clue' });
        if (find && stainVisible(site, find)) notes.push({ text: 'Dark soil stain — something lies deeper', kind: 'clue' });
        if (site.probes.has(cell) && this.tool !== 'probe') notes.push({ text: `Survey flag: ${site.probes.get(cell)} in the 3×3 area`, kind: 'clue' });
        return {
            unit: cellLabel(cell),
            depth: Math.min(d, LAYERS),
            depthM: Math.min(d, LAYERS) * LAYER_DEPTH_M,
            layer: d >= LAYERS ? 'Bedrock' : `${LAYER_NAMES[d]} · layer ${d + 1}/3`,
            notes,
        };
    }

    setTool(tool, fromUser = false) {
        if (this.tool === tool && fromUser) return;
        this.tool = tool;
        hud.setTool(tool, { equip: fromUser });
        this.scene.setTool(tool);
        if (fromUser) audio.toolSwitch();
        this.refreshHover();
    }

    // ============ actions ============

    async act(cell) {
        if (!this.canPlay()) return;
        if (this.busy) { this.queued = cell; return; }
        const site = this.site;
        const find = findAt(site, cell);
        let tool = this.tool;
        if (find?.state === 'exposed' && tool !== 'brush' && tool !== 'probe') {
            this.setTool('brush');
            hud.flashTool('brush');
            tool = 'brush';
        }

        if (tool === 'brush' && !(find && find.state === 'exposed')) {
            toast('Nothing exposed here yet — dig down first.', { icon: 'brush' });
            return;
        }
        if (tool === 'probe') {
            if (site.probes.has(cell)) { toast(`Already surveyed — ${site.probes.get(cell)} nearby.`, { icon: 'probe' }); return; }
            if (site.probesLeft <= 0) { toast('No probes left at this site.', { icon: 'probe', type: 'bad' }); return; }
        }
        if ((tool === 'shovel' || tool === 'trowel') && toolFootprint(tool, cell).every(c => site.depth[c] >= LAYERS || findAt(site, c)?.state === 'exposed')) {
            if (site.depth[cell] >= LAYERS) {
                audio.bedrock();
                this.scene.bedrockFx(cell);
                toast('Bedrock — there’s nothing deeper here.', { icon: 'layers' });
            }
            return;
        }

        this.busy = true;
        try {
            await this.scene.act(tool, cell, () => this.impact(tool, cell, find));
        } finally {
            this.busy = false;
        }
        this.refreshHover();
        if (this.queued != null) {
            const next = this.queued;
            this.queued = null;
            this.act(next);
        }
    }

    impact(tool, cell, find) {
        const site = this.site;
        if (!site || this.site !== site) return;
        if (tool === 'brush') {
            const res = brush(site, cell);
            if (!res.find) return;
            audio.brush(res.progress);
            this.scene.brushFx(res.find, res.progress);
            this.coachDone('brush');
            if (res.recovered) this.onRecovered(res.find);
            else {
                announce(`Brushing… ${Math.round(res.progress * 100)}% clean.`);
                if (this.hoverCell != null) hud.gauge(this.describeCell(this.hoverCell));
            }
            return;
        }
        if (tool === 'probe') {
            const res = probe(site, cell);
            if (res.error) return;
            audio.probe(res.count);
            this.scene.plantFlag(cell, res.count);
            hud.setProbes(site.probesLeft);
            this.coachDone('probe');
            const msg = res.count === 0 ? 'Survey: nothing in the surrounding units.' : `Survey: ${res.count} find${res.count > 1 ? 's' : ''} in the 3×3 area.`;
            toast(msg, { icon: 'probe', type: res.count ? 'gold' : 'info' });
            announce(msg);
            return;
        }

        const layerBefore = site.depth[cell];
        const res = dig(site, cell, tool);
        if (!res.cells.length) return;
        if (tool === 'shovel') audio.shovel(layerBefore); else audio.trowel(layerBefore);
        this.scene.sync();
        this.scene.digFx(res.cells, tool);
        hud.setDug(site.volume / (GRID * GRID * LAYERS));
        if (this.hoverCell != null) hud.gauge(this.describeCell(this.hoverCell));
        this.coachDone('dig');

        for (const f of res.exposed) {
            this.scene.exposeFx(f);
            audio.expose();
            announce('A find is exposed. Use the brush to recover it.');
            this.maybeCoach('brush');
        }
        for (const d of res.damaged) {
            this.scene.damageFx(d.find);
            audio.damage();
            this.damagedThisSite = true;
            toast(d.to >= 3 ? 'Your shovel struck a find — it’s badly damaged!' : 'Your shovel chipped a find.', { type: 'bad', icon: 'shovel' });
            this.maybeCoach('careful');
        }
        if (res.exposed.length) hud.renderFinds(site, this.thumbs);
    }

    /**
     * The discovery sequence: a held breath for rare finds, the lift, the find
     * record, then the find is laid on the tray and its tag pops into the HUD.
     */
    async onRecovered(find) {
        const site = this.site;
        const rank = RARITIES[find.entry.rarity].rank;
        const solo = this.config.mode !== 'multi';
        const reduced = !!settings.get('reducedMotion');
        this.runFinds++;
        const record = progress.recordFind(find);
        const thumbP = artifactThumbnail(find.entry).catch(() => null);
        this.revealing = true;
        this.scene.setHover(null);
        hud.gauge(null);
        hud.setCursor(null);
        if (solo) this.pause();
        this.updatePotential();
        announce(`Recovered: ${displayName(find)}. ${RARITIES[find.entry.rarity].label}.`);

        if (rank >= 2 && !reduced) { audio.hush(rank); await sleep(520); }
        if (this.site !== site || !this.active) return;

        audio.discovery(rank);
        this.scene.shake(0.02 + rank * 0.02);
        document.body.classList.add('revealing');
        document.body.classList.toggle('revealing-solo', solo);
        let release;
        const hold = new Promise(r => { release = r; });
        const landed = this.scene.recoverFx(find, { hold, layout: compactLayout() ? 'below' : 'side' });
        if (!reduced) await sleep(380);

        const auto = solo ? [2800, 3600, 0, 0][rank] : [2200, 2600, 3200, 4000][rank];
        const how = await showFindRecord(find, {
            isNew: record.isNew, improved: record.improved,
            damage: find.condition > find.initialCondition,
            catalogued: progress.uniqueCount, total: ALL_ARTIFACTS.length,
            auto,
        });
        release();
        document.body.classList.remove('revealing', 'revealing-solo');
        if (this.site !== site) return;
        this.revealing = false;
        if (solo && !dialogs.anyOpen()) this.resume();
        if (how === 'inspect') this.inspect(find);

        const thumb = await thumbP;
        if (thumb) this.thumbs.set(find.entry.id, thumb);
        await landed;
        if (this.site !== site) return;
        hud.renderFinds(site, this.thumbs, find.index);
        this.maybeCoach('guess');
        if (this.hoverCell != null && this.canPlay()) this.refreshHover();
    }

    inspect(find) {
        if (!this.active || this.revealing) return;
        this.pause();
        this.ui.inspect(find.entry, { find, revealed: this.roundOver, onClose: () => this.resume() });
    }

    // ============ guessing ============

    guess(country) {
        if (!this.active || this.roundOver || this.guessed || !this.site) return;
        if (this.revealing && this.config.mode !== 'multi') return; // solo: finish reading the find first
        const site = this.site;
        const recovered = recoveredCount(site);
        const correct = country === site.country;
        this.guessed = country;
        this.coachDone('guess');

        if (this.config.mode === 'multi') {
            lobby.guess(country, recovered);
            if (correct) audio.correct(); else audio.wrong();
            toast(correct ? `Correct — ${country}!` : `Not ${country}…`, { type: correct ? 'ok' : 'bad' });
            this.lockForOthers(country);
            this.recordSite(correct, country, correct ? pointsForCorrect(recovered, this.remaining) : -WRONG_GUESS_PENALTY);
            return;
        }

        this.stopTimer();
        this.roundOver = true;
        const points = correct ? pointsForCorrect(recovered, this.config.time ? this.remaining : 0) : -WRONG_GUESS_PENALTY;
        this.score = Math.max(0, this.score + points);
        hud.setScore(this.score, true);
        hud.lockGuess(correct ? `Identified · ${country}` : `Not ${country}`, correct ? 'ok' : 'bad');
        if (correct) audio.correct(); else audio.wrong();
        this.recordSite(correct, country, points);
        setTimeout(() => this.showSoloResults(), 650);
    }

    timeUp() {
        if (this.roundOver || this.guessed) return;
        audio.wrong();
        if (this.config.mode === 'multi') {
            hud.lockGuess('Time’s up — waiting for results', 'bad');
            return;
        }
        this.roundOver = true;
        hud.lockGuess('Time’s up', 'bad');
        this.recordSite(false, null, 0, true);
        setTimeout(() => this.showSoloResults(), 650);
    }

    recordSite(correct, guess, points, timeout = false) {
        const site = this.site;
        const recovered = site.recoveredOrder.slice();
        this.streak = correct ? this.streak + 1 : 0;
        this.bestStreak = Math.max(this.bestStreak, this.streak);
        progress.recordSite(correct);
        this.log.push({
            country: site.country,
            guess,
            correct,
            timeout,
            points,
            recovered: recovered.length,
            legendary: recovered.filter(f => f.entry.rarity === 'legendary').length,
            finds: recovered,
            timeUsed: this.config.time ? Math.round(this.config.time - this.remaining) : null,
        });
    }

    lockForOthers(country) {
        const others = (lobby.lobby?.players?.length || 1) - 1 - [...this.guessedIds].filter(id => id !== lobby.playerId).length;
        hud.lockGuess(others > 0 ? `Locked in · ${country} — keep digging` : `Locked in · ${country}`, 'ok');
    }

    showSoloResults() {
        const entry = this.log[this.log.length - 1];
        const last = this.round >= this.config.rounds - 1;
        this.ui.roundResults({
            entry,
            site: this.site,
            thumbs: this.thumbs,
            score: this.score,
            index: this.round + 1,
            total: this.config.rounds,
            last,
            onContinue: () => (last ? this.finish() : this.loadRound(this.round + 1)),
            onInspect: f => this.ui.inspect(f.entry, { find: f, revealed: true }),
        });
    }

    finish() {
        this.stopTimer();
        const run = this.summary();
        this.exit();
        this.ui.final(run);
    }

    summary() {
        const sites = this.log;
        return {
            mode: this.config.mode,
            daily: this.config.mode === 'daily' ? this.config.daily : null,
            region: this.config.region,
            regionLabel: REGIONS[this.config.region]?.label,
            rounds: this.config.rounds,
            time: this.config.time,
            score: this.score,
            correct: sites.filter(s => s.correct).length,
            finds: sites.reduce((n, s) => n + s.recovered, 0),
            legendary: sites.reduce((n, s) => n + s.legendary, 0),
            bestStreak: this.bestStreak,
            sites,
            thumbs: this.thumbs,
        };
    }

    // ============ multiplayer events ============

    onServerRoundStart(msg) {
        if (!this.active || this.config.mode !== 'multi') return;
        this.loadRound(msg.round - 1, msg);
    }

    onServerRoundGo(msg) {
        if (!this.active) return;
        hud.setGuessEnabled(true);
        this.syncServerTimer(msg);
        if (!msg.timePerRound) hud.setTimer(0, 0);
    }

    onServerGuess(msg) {
        if (!this.active) return;
        this.guessedIds.add(msg.playerId);
        if (msg.playerId !== lobby.playerId) {
            toast(msg.isCorrect ? `${msg.playerName} identified the site` : `${msg.playerName} guessed wrong`, { type: msg.isCorrect ? 'gold' : 'info', icon: msg.isCorrect ? 'check' : 'x' });
        }
        if (this.guessed) this.lockForOthers(this.guessed);
        this.renderStandings();
    }

    onServerScores(standings) {
        this.standings = standings;
        const me = standings.find(p => p.id === lobby.playerId);
        if (me && me.score !== this.score) { this.score = me.score; hud.setScore(this.score, true); }
        this.renderStandings();
    }

    renderStandings() {
        if (this.standings) hud.setStandings(this.standings, lobby.playerId, this.guessedIds);
    }

    onServerRoundEnd(msg) {
        if (!this.active) return;
        this.stopTimer();
        this.roundOver = true;
        const mine = msg.results.find(r => r.playerId === lobby.playerId);
        if (!this.guessed) this.recordSite(false, null, 0, true);
        if (mine) {
            const entry = this.log[this.log.length - 1];
            entry.points = mine.points;
            entry.correct = mine.isCorrect;
        }
        dismissFindRecord();
        this.onServerScores(msg.standings);
        hud.lockGuess('Site closed', 'bad');
        this.ui.roundResults({
            entry: this.log[this.log.length - 1],
            site: this.site,
            thumbs: this.thumbs,
            score: this.score,
            index: this.round + 1,
            total: this.config.rounds,
            multi: msg,
            last: msg.isGameOver,
            onInspect: f => this.ui.inspect(f.entry, { find: f, revealed: true }),
        });
    }

    onServerGameEnd(msg) {
        if (!this.active) return;
        const run = { ...this.summary(), score: msg.yourScore, standings: msg.standings, correct: msg.yourCorrect ?? this.summary().correct };
        this.exit();
        this.ui.final(run);
    }

    // ============ onboarding ============

    maybeCoach(key) {
        if (!key || !settings.get('tips') || progress.tipSeen(key) || !this.active) return;
        const c = COACH[key];
        this.coachKey = key;
        hud.coach(c.step, c.html);
        if (key === 'careful' || key === 'guess') {
            setTimeout(() => this.coachDone(key), 9000);
        }
    }

    coachDone(key) {
        if (!progress.tipSeen(key)) progress.markTip(key);
        if (this.coachKey === key) { hud.hideCoach(); this.coachKey = null; }
    }
}

function factEl(name, text) {
    const span = document.createElement('span');
    span.append(icon(name), text);
    return span;
}

export { isTouch };
