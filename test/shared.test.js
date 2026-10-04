import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveCountry, isCorrectGuess, searchCountries, SITES, ALL_COUNTRIES, sitesInRegion } from '../client/js/shared/countries.js';
import { basePoints, pointsForCorrect, maxPointsPerRound, clampToOption, ROUND_OPTIONS } from '../client/js/shared/rules.js';
import { CATALOG, ALL_ARTIFACTS, MATERIALS, RARITIES, SHAPE_CATEGORY, fieldLabel, formatAge, formatYear } from '../client/js/data/catalog.js';

test('every playable site is guessable and has a full catalog', () => {
    for (const site of SITES) {
        assert.ok(ALL_COUNTRIES.includes(site.name), site.name);
        const list = CATALOG[site.name] || [];
        assert.equal(list.length, 24, site.name);
        const count = r => list.filter(a => a.rarity === r).length;
        assert.deepEqual([count('common'), count('uncommon'), count('rare'), count('legendary')], [10, 7, 5, 2], site.name);
        for (const a of list) assert.equal(a.country, site.name, a.id);
    }
    assert.equal(ALL_ARTIFACTS.length, SITES.length * 24);
});

test('field descriptions never give the country away', () => {
    const giveaways = SITES.map(s => s.name.toLowerCase());
    for (const a of ALL_ARTIFACTS) {
        const label = fieldLabel(a);
        assert.ok(label.length > 2, `${a.id} field label`);
        for (const g of giveaways) assert.ok(!label.toLowerCase().includes(g), `${a.id} field label names ${g}`);
    }
});

test('catalog entries reference known materials, rarities and shapes', () => {
    const ids = new Set();
    for (const a of ALL_ARTIFACTS) {
        assert.ok(!ids.has(a.id), `duplicate ${a.id}`);
        ids.add(a.id);
        assert.ok(MATERIALS[a.mat], `${a.id} material ${a.mat}`);
        if (a.accent) assert.ok(MATERIALS[a.accent], `${a.id} accent ${a.accent}`);
        assert.ok(RARITIES[a.rarity], `${a.id} rarity`);
        assert.ok(SHAPE_CATEGORY[a.shape], `${a.id} shape ${a.shape}`);
        assert.ok(a.note && a.note.length > 30, `${a.id} note`);
    }
});

test('country aliases resolve', () => {
    assert.equal(resolveCountry('USA'), 'United States');
    assert.equal(resolveCountry('england'), 'United Kingdom');
    assert.equal(resolveCountry('Holland'), 'Netherlands');
    assert.equal(resolveCountry('  persia '), 'Iran');
    assert.equal(resolveCountry('Türkiye'), 'Turkey');
    assert.equal(resolveCountry("Côte d'Ivoire"), 'Ivory Coast');
    assert.equal(resolveCountry('Atlantis'), null);
    assert.equal(isCorrectGuess('korea', 'South Korea'), true);
    assert.equal(isCorrectGuess('Egypt', 'Iraq'), false);
});

test('autocomplete ranks prefix matches first', () => {
    assert.equal(searchCountries('eg')[0].name, 'Egypt');
    assert.equal(searchCountries('holl')[0].name, 'Netherlands');
    assert.deepEqual(searchCountries(''), []);
    assert.ok(searchCountries('united').length >= 3);
});

test('regions partition the sites', () => {
    const total = ['europe', 'asia', 'africa-me', 'americas'].reduce((s, r) => s + sitesInRegion(r).length, 0);
    assert.equal(total, SITES.length);
    assert.equal(sitesInRegion('world').length, SITES.length);
});

test('scoring matches the classic table', () => {
    assert.equal(basePoints(0), 500);
    assert.equal(basePoints(1), 500);
    assert.equal(basePoints(2), 400);
    assert.equal(basePoints(5), 100);
    assert.equal(pointsForCorrect(2, 61.9), 461);
    assert.equal(pointsForCorrect(0, 0), 500);
    assert.equal(maxPointsPerRound(), 680);
    assert.equal(clampToOption(7, ROUND_OPTIONS, 5), 5);
    assert.equal(clampToOption('10', ROUND_OPTIONS, 5), 10);
});

test('age and year formatting', () => {
    assert.match(formatAge(-2600000, 2026), /2\.6 million/);
    assert.equal(formatYear(-1323), 'c. 1323 BC');
    assert.equal(formatYear(120), 'c. AD 120');
    assert.equal(formatYear(-38000), 'c. 38,000 BC');
});
