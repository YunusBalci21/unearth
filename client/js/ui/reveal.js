// ============================================
// REVEAL — the find record that accompanies a recovered artifact while it
// hangs in the air above the trench. Common finds get a short catalogue
// entry; rare and legendary finds get the full ceremony.
// ============================================

import { $, h, clear, icon, fmtInt } from './dom.js';
import { RARITIES, formatAge, materialLabel } from '../data/catalog.js';
import { CONDITIONS, LAYER_NAMES, cellLabel, displayName, isObscured, findValue } from '../game/site.js';
import { catalogNumber } from './catalogue.js';
import { audio } from '../audio.js';
import { settings } from '../settings.js';

/** Metres below the surface for the middle of an excavation layer (1-based). */
export const LAYER_DEPTH_M = 0.3;
export const findDepth = layer => (layer - 0.5) * LAYER_DEPTH_M;

let active = null;

/**
 * Show the record and resolve when the player has taken it in.
 * opts: { isNew, improved, damage, catalogued, total, auto (ms or 0 = wait for click), onInspect }
 */
export function showFindRecord(find, opts = {}) {
    dismissFindRecord();
    const entry = find.entry;
    const rank = RARITIES[entry.rarity].rank;
    const root = $('#reveal');
    const record = clear($('#find-record'));
    const stamp = h('div.reveal-stamp', { 'aria-hidden': 'true' });
    const obscured = isObscured(find);
    const reduced = !!settings.get('reducedMotion');

    record.dataset.rarity = entry.rarity;
    record.style.setProperty('--step', `${rank >= 2 ? 150 : rank === 1 ? 110 : 80}ms`);

    const status = opts.isNew ? 'New to your archive' : opts.improved ? 'Better condition recorded' : 'Already in your archive';
    const rows = [
        ['Material', materialLabel(entry)],
        ['Est. age', formatAge(entry.year)],
        ['Condition', CONDITIONS[find.condition].label],
        ['Found', `Unit ${cellLabel(find.cell)} · ${LAYER_NAMES[find.layer - 1]}`],
        ['Depth', `${findDepth(find.layer).toFixed(2)} m`, 'mono'],
        ['Period', h('span', h('span.sealed', { 'aria-label': 'sealed' }), h('span.sealed-note', 'Sealed until the site is identified'))],
        ['Museum value', fmtInt(findValue(find)), 'mono'],
        ['Collection', `${status}${opts.catalogued ? ` · ${opts.catalogued}/${opts.total}` : ''}`],
    ];

    let i = 0;
    const row = (k, v, cls) => {
        const n = i++;
        return [h('dt.fr-row', { style: { '--i': n } }, k), h('dd.fr-row', { class: cls || '', style: { '--i': n } }, v)];
    };
    record.append(...[
        h('div.fr-top',
            h('span', catalogNumber(entry)),
            opts.isNew ? h('span.tag.new', 'New') : opts.improved ? h('span.tag', 'Improved') : h('span.tag', 'Duplicate')),
        h('div.fr-rarity', h('span', { class: `rarity rarity-${entry.rarity}` }, RARITIES[entry.rarity].label)),
        h('h2.fr-name#fr-name', { class: obscured ? 'obscured' : '' }, displayName(find)),
        h('dl.fr-fields', ...rows.flatMap(([k, v, cls]) => row(k, v, cls))),
        opts.damage ? h('p.fr-note.fr-row', { style: { '--i': i++ } }, obscured
            ? 'The shovel shattered it — too damaged to identify by name.'
            : 'Chipped by the shovel on the way out.') : null,
        h('div.fr-foot.fr-row', { style: { '--i': i++ } },
            h('button.btn.btn-sm', { type: 'button', onclick: e => { e.stopPropagation(); finish('inspect'); } }, icon('eye'), 'Inspect'),
            h('span.rarity', { style: { color: 'var(--ink-3)', letterSpacing: '.14em' } }, opts.auto ? '' : 'Click to continue')),
        stamp,
    ].filter(Boolean));

    stamp.textContent = rank >= 3 ? 'Legendary find' : rank === 2 ? 'Rare find' : '';
    stamp.hidden = rank < 2;
    if (rank === 2) stamp.classList.add('rare');
    $('#reveal-hint').textContent = opts.auto ? '' : 'Click anywhere to catalogue';

    root.classList.toggle('cinematic', rank >= 2 && !reduced);
    root.hidden = false;
    record.classList.remove('go');
    void record.offsetWidth;
    requestAnimationFrame(() => {
        root.classList.add('show');
        record.classList.add('go');
    });
    if (rank >= 2) {
        setTimeout(() => { if (active?.find === find) { stamp.classList.add('on'); audio.stamp(); } }, reduced ? 0 : 520);
    }
    if (!reduced) {
        const step = rank >= 2 ? 150 : rank === 1 ? 110 : 80;
        for (let k = 0; k < Math.min(rows.length, 8); k++) {
            setTimeout(() => { if (active?.find === find) audio.tick?.(k); }, 300 + k * step);
        }
    }

    return new Promise(resolve => {
        const state = { find, resolve, timer: null };
        active = state;
        const onClick = e => { if (!e.target.closest('button')) finish('continue'); };
        const onKey = e => {
            if (e.target.closest?.('input, textarea, select')) return; // typing a guess is never interrupted
            if (['Enter', ' ', 'Escape'].includes(e.key)) { e.preventDefault(); e.stopPropagation(); finish('continue'); }
        };
        state.cleanup = () => {
            root.removeEventListener('click', onClick);
            document.removeEventListener('keydown', onKey, true);
            record.removeEventListener('pointerenter', hold);
            record.removeEventListener('pointerleave', release);
        };
        // Reading the record holds it open; leaving gives the full time again.
        const hold = () => clearTimeout(state.timer);
        const release = () => { if (opts.auto) { clearTimeout(state.timer); state.timer = setTimeout(() => finish('continue'), Math.max(1800, opts.auto * 0.6)); } };
        root.addEventListener('click', onClick);
        document.addEventListener('keydown', onKey, true);
        record.addEventListener('pointerenter', hold);
        record.addEventListener('pointerleave', release);
        if (opts.auto) state.timer = setTimeout(() => finish('continue'), opts.auto);
    });

    function finish(how) {
        if (!active || active.find !== find) return;
        const state = active;
        active = null;
        clearTimeout(state.timer);
        state.cleanup();
        root.classList.remove('show');
        setTimeout(() => { if (!active) { root.hidden = true; root.classList.remove('cinematic'); } }, 380);
        if (how === 'inspect') opts.onInspect?.();
        state.resolve(how);
    }
}

/** Close any open record immediately (e.g. the round ended). */
export function dismissFindRecord() {
    if (!active) return;
    const state = active;
    active = null;
    clearTimeout(state.timer);
    state.cleanup?.();
    const root = $('#reveal');
    root.classList.remove('show', 'cinematic');
    root.hidden = true;
    state.resolve('dismissed');
}

export const isRevealing = () => !!active;
