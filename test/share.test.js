import { test } from 'node:test';
import assert from 'node:assert/strict';

// share.js imports DOM helpers; stub just enough for module evaluation.
globalThis.document ??= { querySelector: () => null, addEventListener: () => {} };
const { shareText } = await import('../client/js/share.js');

test('share text is spoiler-free plain text', () => {
    const text = shareText({
        daily: 277, score: 1482, correct: 2, finds: 1, bestStreak: 3, regionLabel: 'Worldwide',
        sites: [
            { country: 'Brazil', correct: true, recovered: 1, legendary: 1 },
            { country: 'Spain', correct: false, recovered: 0 },
            { country: 'France', correct: true, recovered: 0 },
        ],
    });
    assert.match(text, /^UNEARTH · Daily Dig #277$/m);
    assert.match(text, /^✓ ✗ ✓ {3}2\/3 sites identified$/m);
    assert.match(text, /^1,482 pts · 1 find · 1 legendary$/m);
    assert.match(text, /^Best streak: 3 sites$/m);
    for (const country of ['Brazil', 'Spain', 'France']) assert.ok(!text.includes(country));
});
