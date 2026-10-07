// ============================================
// EXCAVATION SITE — pure game logic (no DOM, no three.js).
//
// The site is an 8×8 grid of excavation units. Each unit has three diggable
// layers (topsoil, fill, occupation layer) above bedrock. Finds sit inside
// layer 2 or 3; removing every layer above a find exposes it, a brush then
// recovers it. Deeper layers are older and hold the rarer finds.
// ============================================

import { RARITIES, SHAPE_CATEGORY, estimateValue, fieldLabel, materialAdj } from '../data/catalog.js';

export const GRID = 8;
export const LAYERS = 3;
export const PROBES_PER_SITE = 3;

export const TOOLS = {
    shovel: { id: 'shovel', label: 'Shovel', key: '1', radius: 1 },
    trowel: { id: 'trowel', label: 'Trowel', key: '2', radius: 0 },
    brush: { id: 'brush', label: 'Brush', key: '3', radius: 0 },
    probe: { id: 'probe', label: 'Probe', key: '4', radius: 1 },
};

export const CONDITIONS = [
    { id: 'pristine', label: 'Pristine', factor: 1 },
    { id: 'fine', label: 'Fine', factor: 0.85 },
    { id: 'worn', label: 'Worn', factor: 0.65 },
    { id: 'damaged', label: 'Damaged', factor: 0.4 },
    { id: 'fragmentary', label: 'Fragmentary', factor: 0.2 },
];
/** From this condition index on, a find is too damaged to identify by name. */
export const OBSCURED_FROM = 3;

export const LAYER_NAMES = ['Topsoil', 'Fill', 'Occupation layer', 'Bedrock'];

// ---------- deterministic randomness ----------

export function mulberry32(seed) {
    let a = seed >>> 0;
    return function rng() {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function hashString(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

export function shuffle(list, rng) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

// ---------- grid helpers ----------

export const cellIndex = (x, z) => z * GRID + x;
export const cellX = idx => idx % GRID;
export const cellZ = idx => Math.floor(idx / GRID);
export const inGrid = (x, z) => x >= 0 && z >= 0 && x < GRID && z < GRID;

/** Cells within Chebyshev distance `radius` of idx (including idx), clipped to the grid. */
export function areaAround(idx, radius) {
    const cx = cellX(idx), cz = cellZ(idx);
    const out = [];
    for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
            if (inGrid(cx + dx, cz + dz)) out.push(cellIndex(cx + dx, cz + dz));
        }
    }
    return out;
}

export function chebyshev(a, b) {
    return Math.max(Math.abs(cellX(a) - cellX(b)), Math.abs(cellZ(a) - cellZ(b)));
}

/** Spreadsheet-style unit label, e.g. "C4". Columns A–H, rows 1–8. */
export function cellLabel(idx) {
    return `${String.fromCharCode(65 + cellX(idx))}${cellZ(idx) + 1}`;
}

// ---------- site creation ----------

function pickWeighted(pool, rng) {
    const total = pool.reduce((s, e) => s + RARITIES[e.rarity].weight, 0);
    let r = rng() * total;
    for (const entry of pool) {
        r -= RARITIES[entry.rarity].weight;
        if (r <= 0) return entry;
    }
    return pool[pool.length - 1];
}

function layerFor(entry, rng) {
    const rank = RARITIES[entry.rarity].rank;
    if (rank >= 2) return 3;
    if (rank === 1) return rng() < 0.5 ? 2 : 3;
    return rng() < 0.8 ? 2 : 3;
}

function initialCondition(rng) {
    const r = rng();
    if (r < 0.35) return 0;
    if (r < 0.8) return 1;
    return 2;
}

/**
 * @param {object} opts
 * @param {string} opts.country     canonical site country
 * @param {Array}  opts.pool        catalog entries for that country
 * @param {number} opts.seed        uint32 seed (same seed → same site)
 * @param {number} [opts.findCount]
 */
export function createSite({ country, pool, seed, findCount = 5, probes = PROBES_PER_SITE }) {
    const rng = mulberry32(seed);
    const remaining = pool.slice();
    const chosen = [];
    while (chosen.length < Math.min(findCount, pool.length)) {
        const entry = pickWeighted(remaining, rng);
        chosen.push(entry);
        remaining.splice(remaining.indexOf(entry), 1);
    }

    // Spread finds out: no two finds in neighbouring units when possible.
    let cells = null;
    for (let minGap = 2; minGap >= 1 && !cells; minGap--) {
        for (let attempt = 0; attempt < 400 && !cells; attempt++) {
            const picked = [];
            for (const idx of shuffle([...Array(GRID * GRID).keys()], rng)) {
                if (picked.every(p => chebyshev(p, idx) >= minGap)) picked.push(idx);
                if (picked.length === chosen.length) break;
            }
            if (picked.length === chosen.length) cells = picked;
        }
    }

    const finds = chosen.map((entry, i) => {
        const condition = initialCondition(rng);
        return {
            index: i,
            entry,
            cell: cells[i],
            layer: layerFor(entry, rng),
            state: 'buried',
            condition,
            initialCondition: condition,
            cleaned: 0,
            strokesNeeded: RARITIES[entry.rarity].strokes,
            exposedBy: null,
        };
    });

    // Surface potsherds hint at some finds: on the unit itself or a neighbour.
    const sherds = new Set();
    for (const find of finds) {
        if (rng() >= 0.6) continue;
        const options = areaAround(find.cell, 1).filter(c => !sherds.has(c));
        if (options.length) sherds.add(options[Math.floor(rng() * options.length)]);
    }

    return {
        country,
        seed,
        rng,
        depth: new Uint8Array(GRID * GRID),
        finds,
        sherds,
        probesLeft: probes,
        probes: new Map(), // cell -> count
        recoveredOrder: [],
        actions: 0,
        volume: 0, // units of soil removed
    };
}

// ---------- queries ----------

export function findAt(site, idx, { includeRecovered = false } = {}) {
    return site.finds.find(f => f.cell === idx && (includeRecovered || f.state !== 'recovered')) || null;
}

export function recoveredCount(site) {
    return site.finds.filter(f => f.state === 'recovered').length;
}

export function summary(site) {
    let buried = 0, exposed = 0, recovered = 0;
    for (const f of site.finds) {
        if (f.state === 'buried') buried++;
        else if (f.state === 'exposed') exposed++;
        else recovered++;
    }
    return { buried, exposed, recovered, total: site.finds.length };
}

export function sherdVisible(site, idx) {
    return site.sherds.has(idx) && site.depth[idx] === 0;
}

/** Deep finds stain the soil one layer before they are exposed. */
export function stainVisible(site, find) {
    return find.state === 'buried' && find.layer === 3 && site.depth[find.cell] === 1;
}

export function isObscured(find) {
    return find.condition >= OBSCURED_FROM;
}

/**
 * Name shown for a find. Until the site is identified it is only described
 * the way an excavator would tag it ("Bronze oil lamp"); badly damaged finds
 * get no more than a material and a broad category.
 */
export function displayName(find, { revealed = false } = {}) {
    if (revealed) return find.entry.name;
    if (!isObscured(find)) return fieldLabel(find.entry);
    const cond = CONDITIONS[find.condition].label;
    return `${cond} ${materialAdj(find.entry).toLowerCase()} ${SHAPE_CATEGORY[find.entry.shape] || 'object'}`;
}

export function findValue(find) {
    return estimateValue(find.entry, CONDITIONS[find.condition].factor);
}

/** Cells a tool would act on when used at idx (for hover previews). */
export function toolFootprint(tool, idx) {
    if (tool === 'shovel' || tool === 'probe') return areaAround(idx, 1);
    return [idx];
}

// ---------- actions ----------

function exposeIfReached(site, find, tool, result) {
    if (find.state !== 'buried' || site.depth[find.cell] < find.layer - 1) return;
    find.state = 'exposed';
    find.exposedBy = tool;
    result.exposed.push(find);
    if (tool !== 'shovel') return;
    const r = site.rng();
    const hit = r < 0.2 ? 0 : r < 0.75 ? 1 : 2;
    if (hit > 0) {
        const from = find.condition;
        find.condition = Math.min(CONDITIONS.length - 1, find.condition + hit);
        result.damaged.push({ find, from, to: find.condition });
    }
}

/**
 * Remove one layer with the shovel (3×3 units, risky) or trowel (1 unit, safe).
 * Exposed finds are never dug through — the excavator works around them.
 */
export function dig(site, idx, tool) {
    const result = { tool, cells: [], skipped: [], exposed: [], damaged: [], bedrock: false, redirect: null };
    if (tool !== 'shovel' && tool !== 'trowel') return result;

    const target = findAt(site, idx);
    if (tool === 'trowel' && target && target.state === 'exposed') {
        result.redirect = 'brush';
        return result;
    }

    const cells = tool === 'shovel' ? areaAround(idx, 1) : [idx];
    for (const c of cells) {
        const find = findAt(site, c);
        if (find && find.state === 'exposed') { result.skipped.push(c); continue; }
        if (site.depth[c] >= LAYERS) { result.skipped.push(c); continue; }
        site.depth[c]++;
        site.volume++;
        result.cells.push(c);
        if (find) exposeIfReached(site, find, tool, result);
    }
    if (!result.cells.length && site.depth[idx] >= LAYERS) result.bedrock = true;
    if (result.cells.length) site.actions++;
    return result;
}

/** One careful brush stroke on an exposed find. */
export function brush(site, idx) {
    const find = findAt(site, idx);
    if (!find || find.state !== 'exposed') return { find: null, recovered: false, progress: 0 };
    find.cleaned = Math.min(find.strokesNeeded, find.cleaned + 1);
    site.actions++;
    const recovered = find.cleaned >= find.strokesNeeded;
    if (recovered) {
        find.state = 'recovered';
        site.recoveredOrder.push(find);
    }
    return { find, recovered, progress: find.cleaned / find.strokesNeeded };
}

/** Push a survey probe in: counts unrecovered finds in the surrounding 3×3 units. */
export function probe(site, idx) {
    if (site.probes.has(idx)) return { error: 'already', count: site.probes.get(idx) };
    if (site.probesLeft <= 0) return { error: 'empty' };
    const area = new Set(areaAround(idx, 1));
    const count = site.finds.filter(f => f.state !== 'recovered' && area.has(f.cell)).length;
    site.probesLeft--;
    site.probes.set(idx, count);
    site.actions++;
    return { count };
}
