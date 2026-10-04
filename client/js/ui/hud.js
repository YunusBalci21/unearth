// ============================================
// HUD — instruments around the trench: site plate, survey-tape timer, score,
// equipment belt, depth gauge, specimen tags and the identification slip.
// ============================================

import { $, $$, h, clear, icon, fmtInt, fmtTime, esc } from './dom.js';
import { searchCountries, resolveCountry } from '../shared/countries.js';
import { RARITIES } from '../data/catalog.js';
import { displayName } from '../game/site.js';

export const SOIL_LABEL = { sand: 'Sandy soil', dirt: 'Loam & clay', soil: 'Dark humus' };

/** What each tool is for, shown on the readout above the belt when equipped. */
const TOOL_INFO = {
    shovel: { name: 'Shovel', desc: 'Clears a 3×3 area in one swing.', stats: () => [['Area', '3×3'], ['Pace', 'Fast', 'ok'], ['Finds', 'May chip', 'hi']] },
    trowel: { name: 'Trowel', desc: 'Careful work, one unit at a time.', stats: () => [['Area', '1×1'], ['Pace', 'Slow'], ['Finds', 'Safe', 'ok']] },
    brush: { name: 'Brush', desc: 'Cleans an exposed find until it lifts free.', stats: () => [['Area', 'One find'], ['Strokes', '2–4'], ['Finds', 'Safe', 'ok']] },
    probe: { name: 'Survey probe', desc: 'Counts the finds hidden in the 3×3 units around it.', stats: n => [['Area', '3×3'], ['Charges', `${n} left`, n ? '' : 'hi'], ['Finds', 'Safe', 'ok']] },
};

let handlers = {};
let readoutTimer = null;
let probesLeft = 3;
let currentTool = 'shovel';

export const hud = {
    init(hs) {
        handlers = hs;
        $$('#toolrail .kit-tool').forEach(btn => btn.addEventListener('click', () => handlers.onTool?.(btn.dataset.tool)));
        const belt = $('#toolrail');
        belt.addEventListener('pointerenter', () => { clearTimeout(readoutTimer); $('#kit-readout').classList.remove('faded'); });
        belt.addEventListener('pointerleave', () => fadeReadoutSoon(1200));
        belt.addEventListener('keydown', e => {
            const order = ['shovel', 'trowel', 'brush', 'probe'];
            const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
            if (!step) return;
            e.preventDefault();
            const next = order[(order.indexOf(currentTool) + step + order.length) % order.length];
            handlers.onTool?.(next);
            $(`#toolrail .kit-tool[data-tool="${next}"]`)?.focus();
        });
        $('#hud-pause').addEventListener('click', () => handlers.onPause?.());
        $('#coach-close').addEventListener('click', () => handlers.onCoachClose?.());
        initCombobox();
    },

    show(on) {
        $('#hud').classList.toggle('active', on);
        $('#hud').setAttribute('aria-hidden', String(!on));
        if (!on) { hud.gauge(null); hud.hideCoach(); setCursorTool(null); }
    },

    setSite({ index, total, soil, modeLabel }) {
        $('#hud-site-num').textContent = `Site ${String(index).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
        $('#hud-site-title').textContent = 'Unidentified site';
        $('#hud-soil').textContent = SOIL_LABEL[soil] || 'Mixed soil';
        $('#hud-mode').textContent = modeLabel || '';
        hud.setDug(0);
    },

    setDug(fraction) {
        $('#hud-dug').textContent = `${Math.round(fraction * 100)}% excavated`;
    },

    /** Paint the gauge's stratigraphic column in this site's soil colours. */
    setSoil(colors = []) {
        const col = $('#gauge-col');
        colors.slice(0, 3).forEach((c, i) => col.style.setProperty(`--g${i}`, `#${c.toString(16).padStart(6, '0')}`));
    },

    setTimer(remaining, total) {
        const el = $('#hud-timer');
        const tape = el.querySelector('.ht-tape');
        if (!total) {
            el.classList.add('infinite');
            el.classList.remove('warn', 'critical');
            $('#hud-time').textContent = '∞';
            tape.style.setProperty('--value', 1);
            el.setAttribute('aria-label', 'No time limit');
            return;
        }
        el.classList.remove('infinite');
        $('#hud-time').textContent = fmtTime(remaining);
        tape.style.setProperty('--value', Math.max(0, remaining / total));
        el.classList.toggle('warn', remaining <= 30 && remaining > 10);
        el.classList.toggle('critical', remaining <= 10);
        el.setAttribute('aria-label', `${Math.ceil(remaining)} seconds remaining`);
    },

    setScore(score, bump = false) {
        const el = $('#hud-score');
        el.textContent = fmtInt(score);
        if (bump) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
    },

    /** Equip a tool on the belt; `equip` plays the small equip animation and shows its readout. */
    setTool(tool, { equip = false } = {}) {
        currentTool = tool;
        $$('#toolrail .kit-tool').forEach(btn => {
            const on = btn.dataset.tool === tool;
            btn.setAttribute('aria-checked', String(on));
            btn.tabIndex = on ? 0 : -1;
            if (on && equip) { btn.classList.remove('equip'); void btn.offsetWidth; btn.classList.add('equip'); }
        });
        setCursorTool(tool);
        renderReadout(tool);
        if (equip) fadeReadoutSoon(2800);
        else $('#kit-readout').classList.add('faded');
    },

    flashTool(tool) {
        const btn = $(`#toolrail .kit-tool[data-tool="${tool}"]`);
        if (!btn) return;
        btn.classList.remove('flash'); void btn.offsetWidth; btn.classList.add('flash');
    },

    setProbes(n) {
        probesLeft = n;
        const host = $('#hud-probes');
        [...host.children].forEach((pip, i) => pip.classList.toggle('used', i >= n));
        host.setAttribute('aria-label', `${n} probe${n === 1 ? '' : 's'} left`);
        $('#toolrail .kit-tool[data-tool="probe"]').classList.toggle('empty', n <= 0);
        if (currentTool === 'probe') renderReadout('probe');
    },

    /** The finds column: one specimen tag per buried find. thumbs: Map(entryId → dataURL) */
    renderFinds(site, thumbs, popIndex = -1) {
        const host = clear($('#hud-slots'));
        const order = [...site.recoveredOrder, ...site.finds.filter(f => f.state === 'exposed'), ...site.finds.filter(f => f.state === 'buried')];
        for (const find of order) {
            let el;
            if (find.state === 'recovered') {
                const img = thumbs.get(find.entry.id);
                el = h('button.ftag.recovered', {
                    type: 'button', dataset: { rarity: find.entry.rarity },
                    'aria-label': `${displayName(find)} — inspect`,
                    onclick: () => handlers.onInspect?.(find),
                },
                h('span.ft-card'),
                img ? h('img', { src: img, alt: '' }) : icon('pot'),
                h('span.ft-label', h('strong', displayName(find)), h('span', { class: `rarity rarity-${find.entry.rarity}` }, RARITIES[find.entry.rarity].label)));
                if (find.index === popIndex) el.classList.add('pop');
            } else if (find.state === 'exposed') {
                el = h('button.ftag.exposed', { type: 'button', 'aria-label': 'Exposed find — go to it', onclick: () => handlers.onFocusFind?.(find) },
                    h('span.ft-card'), icon('brush'),
                    h('span.ft-label', h('strong', 'Exposed find'), h('span.rarity', 'Brush it to recover')));
            } else {
                el = h('div.ftag.buried', { 'aria-label': 'Still buried' }, h('span.ft-card'), h('span.ft-q', '?'));
            }
            host.append(el);
        }
        $('#hud-finds-count').textContent = `${site.recoveredOrder.length}/${site.finds.length}`;
    },

    setPotential(base, bonus) {
        $('#guess-hint').textContent = `If correct now: ${fmtInt(base + bonus)} pts${bonus > 0 ? ` (${base} + ${bonus} time)` : ''}`;
    },

    /**
     * Depth gauge for the unit under the cursor.
     * info: { unit, depth (0–3), depthM, layer, notes: [{ text, kind: 'warn'|'clue'|'' }] } or null
     */
    gauge(info) {
        const g = $('#hud-gauge');
        const col = $('#gauge-col');
        const notes = clear($('#gauge-notes'));
        if (!info) {
            g.classList.add('idle');
            col.style.setProperty('--d', 0);
            $('#gauge-unit').textContent = '—';
            $('#gauge-depth').textContent = 'Depth —';
            $('#gauge-layer').textContent = 'Survey a unit';
            return;
        }
        g.classList.remove('idle');
        col.style.setProperty('--d', info.depth);
        $('#gauge-unit').textContent = info.unit;
        $('#gauge-depth').textContent = `Depth ${info.depthM.toFixed(2)} m`;
        $('#gauge-layer').textContent = info.layer;
        for (const n of info.notes.slice(0, 3)) notes.append(h('li', { class: n.kind || '' }, n.text));
    },

    coach(step, html) {
        const el = $('#coach');
        $('#coach-step').textContent = String(step);
        // `html` is a trusted template with <b>/<kbd> markers only
        $('#coach-text').innerHTML = html;
        el.hidden = false;
        el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    },

    hideCoach() { $('#coach').hidden = true; },

    resetGuess() {
        const input = $('#guess-input');
        input.value = '';
        input.disabled = false;
        $('#guess-submit').disabled = true;
        $('#guess-form').classList.remove('locked', 'bad');
        closeList();
    },

    /** Stamp the slip: kind 'ok' (green), 'bad' (red) or neutral. */
    lockGuess(text, kind = 'ok') {
        const form = $('#guess-form');
        form.classList.add('locked');
        form.classList.toggle('bad', kind === 'bad');
        $('#guess-locked-text').textContent = text;
        $('#guess-input').disabled = true;
        closeList();
    },

    setGuessEnabled(on) {
        $('#guess-input').disabled = !on;
        if (!on) $('#guess-submit').disabled = true;
        else updateSubmit();
    },

    focusGuess() { $('#guess-input').focus(); },

    setStandings(list, myId, guessed = new Set()) {
        const box = $('#hud-standings');
        if (!list) { box.hidden = true; document.body.classList.remove('multiplayer'); return; }
        box.hidden = false;
        document.body.classList.add('multiplayer');
        clear(box);
        list.forEach(p => {
            box.append(h('li', { class: p.id === myId ? 'you' : '' },
                h('span.dot', { style: { '--c': p.color } }),
                h('span.n', p.name),
                guessed.has(p.id) ? icon('check') : h('span'),
                h('span.s', fmtInt(p.score))));
        });
    },
};

/** The canvas cursor becomes the equipped tool. */
function setCursorTool(tool, blocked = false) {
    const sc = document.getElementById('scene');
    sc.classList.remove('tool-shovel', 'tool-trowel', 'tool-brush', 'tool-probe', 'blocked');
    if (tool) sc.classList.add(`tool-${tool}`);
    sc.classList.toggle('blocked', !!tool && blocked);
}
hud.setCursor = (tool, blocked = false) => setCursorTool(tool || currentTool, blocked);

function renderReadout(tool) {
    const info = TOOL_INFO[tool];
    const el = clear($('#kit-readout'));
    el.append(
        h('span.kr-name', info.name),
        h('span.kr-desc', info.desc),
        h('span.kr-stats', ...info.stats(probesLeft).map(([k, v, cls]) => h('span', `${k} `, h('b', { class: cls || '' }, v)))));
}

function fadeReadoutSoon(ms) {
    clearTimeout(readoutTimer);
    $('#kit-readout').classList.remove('faded');
    readoutTimer = setTimeout(() => $('#kit-readout').classList.add('faded'), ms);
}

// ---------- country combobox ----------

let options = [];
let active = -1;

function initCombobox() {
    const input = $('#guess-input');
    const form = $('#guess-form');
    input.addEventListener('input', () => { renderList(input.value); updateSubmit(); });
    input.addEventListener('focus', () => { if (input.value) renderList(input.value); });
    input.addEventListener('blur', () => setTimeout(closeList, 120));
    input.addEventListener('keydown', e => {
        const list = $('#guess-list');
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            if (list.hidden) renderList(input.value);
            if (!options.length) return;
            e.preventDefault();
            active = (active + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
            highlight();
        } else if (e.key === 'Enter') {
            if (!list.hidden && active >= 0 && options[active]) {
                e.preventDefault();
                choose(options[active].name);
                if (e.ctrlKey || e.metaKey) form.requestSubmit();
            }
        } else if (e.key === 'Escape') {
            if (!list.hidden) { e.preventDefault(); e.stopPropagation(); closeList(); }
            else input.blur();
        } else if (e.key === 'Tab' && !list.hidden && options[active]) {
            choose(options[active].name);
        }
        // keep tool hotkeys from firing while typing
        e.stopPropagation();
    });
    form.addEventListener('submit', e => {
        e.preventDefault();
        const country = resolveCountry(input.value);
        if (!country) {
            if (options[0]) choose(options[0].name);
            return;
        }
        handlers.onGuess?.(country);
    });
}

function renderList(query) {
    const list = $('#guess-list');
    options = searchCountries(query, 7);
    active = options.length ? 0 : -1;
    clear(list);
    if (!options.length || (options.length === 1 && options[0].name === resolveCountry(query) && !options[0].alias)) {
        closeList();
        return;
    }
    const q = query.trim().toLowerCase();
    options.forEach((opt, i) => {
        const name = opt.name;
        const at = name.toLowerCase().indexOf(q);
        const label = at >= 0 && q
            ? [name.slice(0, at), h('mark', name.slice(at, at + q.length)), name.slice(at + q.length)]
            : [name];
        const li = h('li', { role: 'option', id: `guess-opt-${i}`, 'aria-selected': 'false' },
            h('span', ...label), opt.alias ? h('small', `“${opt.alias}”`) : null);
        li.addEventListener('pointerdown', e => { e.preventDefault(); choose(name); });
        list.append(li);
    });
    list.hidden = false;
    $('#guess-input').setAttribute('aria-expanded', 'true');
    highlight();
}

function highlight() {
    $$('#guess-list li').forEach((li, i) => li.setAttribute('aria-selected', String(i === active)));
    const input = $('#guess-input');
    if (active >= 0) {
        input.setAttribute('aria-activedescendant', `guess-opt-${active}`);
        $(`#guess-opt-${active}`)?.scrollIntoView({ block: 'nearest' });
    } else input.removeAttribute('aria-activedescendant');
}

function choose(name) {
    const input = $('#guess-input');
    input.value = name;
    closeList();
    updateSubmit();
}

function closeList() {
    const list = $('#guess-list');
    list.hidden = true;
    options = [];
    active = -1;
    $('#guess-input').setAttribute('aria-expanded', 'false');
    $('#guess-input').removeAttribute('aria-activedescendant');
}

function updateSubmit() {
    const input = $('#guess-input');
    $('#guess-submit').disabled = input.disabled || !resolveCountry(input.value);
}

export { esc };
