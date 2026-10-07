// Unearth uses drawn SVG icons (client/icons.svg), never emoji.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOTS = ['client', 'public/admin', 'server.js'];
const TEXT = new Set(['.js', '.html', '.css', '.svg', '.json', '.webmanifest']);
const EMOJI = /(?![©®™])\p{Extended_Pictographic}|️/gu;

function* files(path) {
    if (statSync(path).isDirectory()) {
        for (const name of readdirSync(path)) yield* files(join(path, name));
    } else if (TEXT.has(extname(path)) || path.endsWith('.js')) {
        yield path;
    }
}

test('no emoji in game, admin panel or server sources', () => {
    const hits = [];
    for (const root of ROOTS) {
        for (const file of files(root)) {
            readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
                const found = line.match(EMOJI);
                if (found) hits.push(`${file}:${i + 1} ${found.join(' ')}`);
            });
        }
    }
    assert.deepEqual(hits, []);
});
