import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    createSite, dig, brush, probe, findAt, recoveredCount, summary, areaAround, cellIndex,
    chebyshev, displayName, isObscured, stainVisible, sherdVisible, cellLabel, LAYERS, GRID,
} from '../client/js/game/site.js';
import { CATALOG } from '../client/js/data/catalog.js';

const make = (seed = 42, country = 'Egypt') => createSite({ country, pool: CATALOG[country], seed });

test('same seed produces the same site', () => {
    const a = make(7), b = make(7);
    assert.deepEqual(a.finds.map(f => [f.entry.id, f.cell, f.layer, f.condition]),
        b.finds.map(f => [f.entry.id, f.cell, f.layer, f.condition]));
    assert.deepEqual([...a.sherds], [...b.sherds]);
});

test('sites place five distinct, well spread finds', () => {
    for (let seed = 1; seed < 200; seed++) {
        const site = make(seed, 'Greece');
        assert.equal(site.finds.length, 5);
        assert.equal(new Set(site.finds.map(f => f.entry.id)).size, 5);
        assert.equal(new Set(site.finds.map(f => f.cell)).size, 5);
        for (const f of site.finds) {
            assert.ok(f.layer === 2 || f.layer === 3);
            for (const g of site.finds) if (f !== g) assert.ok(chebyshev(f.cell, g.cell) >= 1);
        }
    }
});

test('rare and legendary finds are always in the deepest layer', () => {
    for (let seed = 1; seed < 300; seed++) {
        for (const f of make(seed, 'China').finds) {
            if (f.entry.rarity === 'rare' || f.entry.rarity === 'legendary') assert.equal(f.layer, 3);
        }
    }
});

test('trowel digs one unit, one layer, and exposes without damage', () => {
    const site = make(11);
    const find = site.finds[0];
    for (let d = 0; d < find.layer - 1; d++) {
        const before = find.condition;
        const res = dig(site, find.cell, 'trowel');
        assert.deepEqual(res.cells, [find.cell]);
        assert.equal(find.condition, before);
    }
    assert.equal(find.state, 'exposed');
    assert.equal(find.exposedBy, 'trowel');
    assert.equal(site.depth[find.cell], find.layer - 1);
});

test('shovel digs a 3×3 area and works around exposed finds', () => {
    const site = make(5);
    const center = cellIndex(4, 4);
    const res = dig(site, center, 'shovel');
    assert.equal(res.cells.length + res.skipped.length, 9);
    // Keep digging the same spot: an exposed find is never dug through.
    for (let i = 0; i < LAYERS + 2; i++) dig(site, center, 'shovel');
    for (const f of site.finds) {
        if (f.state === 'exposed') assert.equal(site.depth[f.cell], f.layer - 1);
    }
    for (const c of areaAround(center, 1)) {
        const f = findAt(site, c);
        if (!f) assert.equal(site.depth[c], LAYERS);
    }
});

test('shovel exposure can damage finds; damage is recorded', () => {
    let damaged = 0, exposures = 0;
    for (let seed = 1; seed < 400; seed++) {
        const site = make(seed, 'Peru');
        const find = site.finds[0];
        let res;
        do { res = dig(site, find.cell, 'shovel'); } while (find.state === 'buried');
        exposures++;
        assert.equal(find.exposedBy, 'shovel');
        if (res.damaged.length) {
            damaged++;
            assert.ok(res.damaged[0].to > res.damaged[0].from);
            assert.equal(find.condition, res.damaged[0].to);
        }
    }
    const rate = damaged / exposures;
    assert.ok(rate > 0.6 && rate < 0.95, `damage rate ${rate}`);
});

test('trowel on an exposed find redirects to the brush', () => {
    const site = make(3);
    const find = site.finds[1];
    while (find.state === 'buried') dig(site, find.cell, 'trowel');
    const res = dig(site, find.cell, 'trowel');
    assert.equal(res.redirect, 'brush');
    assert.equal(res.cells.length, 0);
});

test('brushing recovers after the required strokes', () => {
    const site = make(9);
    const find = site.finds[2];
    assert.equal(brush(site, find.cell).find, null, 'cannot brush a buried find');
    while (find.state === 'buried') dig(site, find.cell, 'trowel');
    let res;
    for (let i = 0; i < find.strokesNeeded; i++) res = brush(site, find.cell);
    assert.equal(res.recovered, true);
    assert.equal(find.state, 'recovered');
    assert.equal(recoveredCount(site), 1);
    assert.deepEqual(summary(site), { buried: 4, exposed: 0, recovered: 1, total: 5 });
    // After recovery the unit can be dug again
    const before = site.depth[find.cell];
    dig(site, find.cell, 'trowel');
    assert.equal(site.depth[find.cell], Math.min(LAYERS, before + 1));
});

test('probes count unrecovered finds in 3×3 and are limited', () => {
    const site = make(21);
    const find = site.finds[0];
    const res = probe(site, find.cell);
    assert.ok(res.count >= 1);
    assert.equal(probe(site, find.cell).error, 'already');
    probe(site, cellIndex(0, 0));
    probe(site, cellIndex(7, 7));
    assert.equal(site.probesLeft, 0);
    assert.equal(probe(site, cellIndex(3, 0)).error, 'empty');
});

test('bedrock stops digging', () => {
    const site = make(1);
    const empty = [...Array(GRID * GRID).keys()].find(c => !findAt(site, c));
    for (let i = 0; i < LAYERS; i++) dig(site, empty, 'trowel');
    const res = dig(site, empty, 'trowel');
    assert.equal(res.bedrock, true);
    assert.equal(site.depth[empty], LAYERS);
});

test('clues: sherds vanish when dug, stains appear above deep finds', () => {
    for (let seed = 1; seed < 60; seed++) {
        const site = make(seed, 'Japan');
        for (const c of site.sherds) {
            assert.equal(sherdVisible(site, c), true);
        }
        const deep = site.finds.find(f => f.layer === 3);
        if (!deep) continue;
        assert.equal(stainVisible(site, deep), false);
        dig(site, deep.cell, 'trowel');
        assert.equal(stainVisible(site, deep), true);
        dig(site, deep.cell, 'trowel');
        assert.equal(stainVisible(site, deep), false);
        assert.equal(deep.state, 'exposed');
        for (const c of site.sherds) if (site.depth[c] > 0) assert.equal(sherdVisible(site, c), false);
    }
});

test('badly damaged finds hide their name', () => {
    const site = make(2);
    const find = site.finds[0];
    find.condition = 4;
    assert.equal(isObscured(find), true);
    assert.notEqual(displayName(find), find.entry.name);
    assert.match(displayName(find), /^Fragmentary /);
    find.condition = 0;
    assert.equal(displayName(find, { revealed: true }), find.entry.name);
});

test('finds are only described until the site is identified', () => {
    const site = make(3);
    for (const find of site.finds) {
        find.condition = 0;
        const tag = displayName(find);
        assert.ok(tag.length > 2, `${find.entry.id} has a field description`);
        assert.ok(!tag.toLowerCase().includes(find.entry.country.toLowerCase()), `${find.entry.id} tag hides the country`);
        assert.equal(displayName(find, { revealed: true }), find.entry.name);
    }
});

test('unit labels', () => {
    assert.equal(cellLabel(cellIndex(0, 0)), 'A1');
    assert.equal(cellLabel(cellIndex(7, 7)), 'H8');
});
