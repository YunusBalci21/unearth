// Catalogue numbering shared by the find record, inspector and archive.

/** "Cat. BR-002" from catalogue id "br2". */
export function catalogNumber(entry) {
    const m = entry.id.match(/^([a-z]+)(\d+)$/i);
    return m ? `Cat. ${m[1].toUpperCase()}-${m[2].padStart(3, '0')}` : `Cat. ${entry.id.toUpperCase()}`;
}
