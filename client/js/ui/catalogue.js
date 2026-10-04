// Catalogue numbering shared by the find record, inspector and archive.

import { cellLabel } from '../game/site.js';

/** "Cat. BR-002" from catalogue id "br2". */
export function catalogNumber(entry) {
    const m = entry.id.match(/^([a-z]+)(\d+)$/i);
    return m ? `Cat. ${m[1].toUpperCase()}-${m[2].padStart(3, '0')}` : `Cat. ${entry.id.toUpperCase()}`;
}

/**
 * Small-find number used on site before identification ("SF 03 · C4").
 * The catalogue number carries a country code, so it stays hidden until then.
 */
export function fieldNumber(find) {
    return `SF ${String(find.index + 1).padStart(2, '0')} · Unit ${cellLabel(find.cell)}`;
}
