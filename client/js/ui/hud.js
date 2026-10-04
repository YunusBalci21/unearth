// ============================================
// HUD — in-game overlay: site card, timer, score, tools, finds, guess bar.
// ============================================

import { $, $$, h, clear, svgIcon, fmtInt, fmtTime, esc } from './dom.js';
import { searchCountries, resolveCountry } from '../shared/countries.js';
import { RARITIES, formatAge, materialLabel } from '../data/catalog.js';
import { CONDITIONS, displayName, isObscured, findValue } from '../game/site.js';

const SOIL_LABEL = { sand: 'Sandy soil', dirt: 'Loam & clay', soil: 'Dark humus' };

let handlers = {};
let discoveryTimer = null;

export const hud = {
    init(h) {
        handlers = h;
        $$('#toolrail .tool').forEach(btn => btn.addEventListener('click', () => handlers.onTool?.(btn.dataset.tool)));
        $('#hud-pause').addEventListener('click', () => handlers.onPause?.());
        $('#coach-close').addEventListener('click', () => handlers.onCoachClose?.());
        initCombobox();
        const disc = $('#discovery');
        disc.addEventListener('mouseenter', () => clearTimeout(discoveryTimer));
        disc.addEventListener('mouseleave', () => { discoveryTimer = setTimeout(() => hud.hideDiscovery(), 2500); });
    },

    show(on) {
        $('#hud').classList.toggle('active', on);
        $('#hud').setAttribute('aria-hidden', String(!on));
        if (!on) { hud.hideTip(); hud.hideDiscovery(); hud.hideCoach(); }
    },

    setSite({ index, total, soil, modeLabel }) {
        $('#hud-site-num').textContent = `Site ${index} of ${total}`;
        $('#hud-site-title').textContent = 'Unidentified site';
        $('#hud-soil').textContent = SOIL_LABEL[soil] || 'Mixed soil';
        $('#hud-mode').textContent = modeLabel || '';
    },

    setTimer(remaining, total) {
        const el = $('#hud-timer');
        if (!total) {
            el.classList.add('infinite');
            el.classList.remove('warn', 'critical');
            $('#hud-time').textContent = '∞';
            el.querySelector('.scalebar').style.setProperty('--value', 1);
            el.setAttribute('aria-label', 'No time limit');
            return;
        }
        el.classList.remove('infinite');
        $('#hud-time').textContent = fmtTime(remaining);
        el.querySelector('.scalebar').style.setProperty('--value', Math.max(0, remaining / total));
        el.classList.toggle('warn', remaining <= 30 && remaining > 10);
        el.classList.toggle('critical', remaining <= 10);
        el.setAttribute('aria-label', `${Math.ceil(remaining)} seconds remaining`);
    },

    setScore(score, bump = false) {
        const el = $('#hud-score');
        el.textContent = fmtInt(score);
        if (bump) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
    },

    setTool(tool) {
        $$('#toolrail .tool').forEach(btn => btn.setAttribute('aria-checked', String(btn.dataset.tool === tool)));
    },

    flashTool(tool) {
        const btn = $(`#toolrail .tool[data-tool="${tool}"]`);
        if (!btn) return;
        btn.classList.remove('flash'); void btn.offsetWidth; btn.classList.add('flash');
    },

    setProbes(n) {
        $('#hud-probes').textContent = String(n);
        $('#toolrail .tool[data-tool="probe"]').classList.toggle('empty', n <= 0);
    },

    /** Finds tray. thumbs: Map(entryId -> dataURL) */
    renderFinds(site, thumbs, popIndex = -1) {
        const host = $('#hud-slots');
        clear(host);
        const order = [...site.recoveredOrder, ...site.finds.filter(f => f.state === 'exposed'), ...site.finds.filter(f => f.state === 'buried')];
        order.forEach(find => {
            let el;
            if (find.state === 'recovered') {
                const img = thumbs.get(find.entry.id);
                el = h('button.slot.recovered', {
                    type: 'button', dataset: { rarity: find.entry.rarity },
                    'aria-label': `Inspect ${displayName(find)}`,
                    onclick: () => handlers.onInspect?.(find),
                },
                h('span.thumb', img ? h('img', { src: img, alt: '' }) : svgIcon('pot')),
                h('span.txt', h('strong', displayName(find)), h('small', { class: `rarity rarity-${find.entry.rarity}` }, RARITIES[find.entry.rarity].label)));
                if (find.index === popIndex) el.classList.add('pop');
            } else if (find.state === 'exposed') {
                el = h('button.slot.exposed', { type: 'button', 'aria-label': 'Exposed find — go to it', onclick: () => handlers.onFocusFind?.(find) },
                    h('span.thumb', svgIcon('brush')),
                    h('span.txt', h('strong', 'Exposed find'), h('small', 'Brush to recover')));
            } else {
                el = h('div.slot', { 'aria-label': 'Undiscovered' },
                    h('span.thumb', svgIcon('search')),
                    h('span.txt', h('strong', { style: { color: 'var(--parchment-mute)', fontWeight: 400 } }, 'Undiscovered')));
            }
            host.append(el);
        });
        const rec = site.recoveredOrder.length;
        $('#hud-finds-count').textContent = `${rec} / ${site.finds.length}`;
    },

    setPotential(base, bonus) {
        const el = $('#hud-potential');
        clear(el);
        el.append(fmtInt(base + bonus));
        if (bonus > 0) el.append(' ', h('small', `(${base} + ${bonus})`));
        $('#guess-hint').textContent = `Correct now: ${fmtInt(base + bonus)} pts`;
    },

    showDiscovery(find, { thumb, isNew, improved, damage }) {
        const el = $('#discovery');
        clear(el);
        el.dataset.rarity = find.entry.rarity;
        const obscured = isObscured(find);
        const art = h('div.art', thumb ? h('img', { src: thumb, alt: '' }) : h('span.skeleton', { style: { width: '120px', height: '120px', borderRadius: '50%' } }));
        el.append(...[
            h('div.row',
                h('span', { class: `rarity rarity-${find.entry.rarity}` }, RARITIES[find.entry.rarity].label),
                isNew ? h('span.badge.new', 'New') : improved ? h('span.badge.ok', 'Better condition') : null),
            art,
            h('div.name', displayName(find)),
            h('div.stats',
                stat('Material', materialLabel(find.entry)),
                stat('Age', formatAge(find.entry.year).replace(' years old', ' yrs')),
                stat('Condition', CONDITIONS[find.condition].label)),
            damage ? h('p.damage-note', obscured
                ? 'The shovel shattered it — too damaged to identify by name.'
                : 'Chipped by the shovel on the way out.') : null,
            h('div.row',
                h('span.kicker', `Est. value ${fmtInt(findValue(find))}`),
                h('button.btn.btn-sm', { type: 'button', onclick: () => handlers.onInspect?.(find) }, svgIcon('eye'), 'Inspect')),
        ].filter(Boolean));
        el.classList.add('show');
        el.dataset.find = find.entry.id;
        clearTimeout(discoveryTimer);
        discoveryTimer = setTimeout(() => hud.hideDiscovery(), find.entry.rarity === 'legendary' ? 8000 : 5500);
    },

    /** Fill in the discovery card's picture once the thumbnail is rendered. */
    setDiscoveryArt(entryId, thumb) {
        const el = $('#discovery');
        if (el.dataset.find !== entryId || !thumb) return;
        const art = el.querySelector('.art');
        clear(art).append(h('img', { src: thumb, alt: '' }));
    },

    hideDiscovery() {
        clearTimeout(discoveryTimer);
        $('#discovery').classList.remove('show');
    },

    showTip(lines, x, y) {
        const el = $('#cell-tip');
        clear(el);
        el.append(h('div.head', h('b', lines.unit), h('span', lines.layer)));
        for (const l of lines.notes || []) el.append(h('div', { class: `act${l.warn ? ' warn' : ''}` }, l.text));
        el.hidden = false;
        const w = el.offsetWidth, hgt = el.offsetHeight;
        const left = Math.min(x, innerWidth - w - 24);
        const top = Math.min(y, innerHeight - hgt - 24);
        el.style.left = `${left}px`;
        el.style.top = `${top}px`;
    },

    hideTip() { $('#cell-tip').hidden = true; },

    coach(step, html) {
        const el = $('#coach');
        $('#coach-step').textContent = String(step);
        const p = $('#coach-text');
        clear(p);
        // `html` is a trusted template with <kbd> markers only
        p.innerHTML = html;
        el.hidden = false;
    },

    hideCoach() { $('#coach').hidden = true; },

    resetGuess() {
        const input = $('#guess-input');
        input.value = '';
        input.disabled = false;
        $('#guess-submit').disabled = true;
        $('#guess-form').classList.remove('locked');
        closeList();
    },

    lockGuess(text) {
        $('#guess-form').classList.add('locked');
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
        const ol = clear($('#hud-standings-list'));
        list.forEach(p => {
            ol.append(h('li', { class: p.id === myId ? 'you' : '' },
                h('span.dot', { style: { '--c': p.color } }),
                h('span.n', p.name),
                guessed.has(p.id) ? svgIcon('check', 'done') : null,
                h('span.s', fmtInt(p.score))));
        });
    },
};

function stat(k, v) {
    return h('div.stat', h('span.k', k), h('span.v', v));
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
