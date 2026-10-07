// ============================================
// COUNTRIES — shared by the browser client and the Node server.
// Keep this file free of DOM / Node-only APIs.
// ============================================

export const REGIONS = {
    world: { id: 'world', label: 'Worldwide' },
    europe: { id: 'europe', label: 'Europe' },
    asia: { id: 'asia', label: 'Asia' },
    'africa-me': { id: 'africa-me', label: 'Africa & Middle East' },
    americas: { id: 'americas', label: 'Americas & Oceania' },
};

// Playable excavation countries. `soil` drives the strata palette, `tint` the topsoil colour.
export const SITES = [
    { name: 'Egypt', region: 'africa-me', soil: 'sand', tint: 0xd4a574 },
    { name: 'Greece', region: 'europe', soil: 'dirt', tint: 0x8b7355 },
    { name: 'China', region: 'asia', soil: 'soil', tint: 0x6b4a2b },
    { name: 'Mexico', region: 'americas', soil: 'sand', tint: 0xc2a070 },
    { name: 'Japan', region: 'asia', soil: 'soil', tint: 0x4a3322 },
    { name: 'Italy', region: 'europe', soil: 'dirt', tint: 0x9b7653 },
    { name: 'India', region: 'asia', soil: 'soil', tint: 0xa4602a },
    { name: 'Peru', region: 'americas', soil: 'sand', tint: 0xa0826d },
    { name: 'Iraq', region: 'africa-me', soil: 'sand', tint: 0xc4a35a },
    { name: 'France', region: 'europe', soil: 'dirt', tint: 0x8b7d6b },
    { name: 'United Kingdom', region: 'europe', soil: 'soil', tint: 0x5e4f43 },
    { name: 'Spain', region: 'europe', soil: 'sand', tint: 0xb8956a },
    { name: 'Germany', region: 'europe', soil: 'dirt', tint: 0x7a6952 },
    { name: 'Netherlands', region: 'europe', soil: 'soil', tint: 0x5c5040 },
    { name: 'Ireland', region: 'europe', soil: 'soil', tint: 0x4f4a36 },
    { name: 'Russia', region: 'europe', soil: 'soil', tint: 0x5e5246 },
    { name: 'Turkey', region: 'africa-me', soil: 'dirt', tint: 0xa08060 },
    { name: 'Iran', region: 'africa-me', soil: 'sand', tint: 0xb89070 },
    { name: 'Morocco', region: 'africa-me', soil: 'sand', tint: 0xc49a6c },
    { name: 'South Korea', region: 'asia', soil: 'soil', tint: 0x5a4a3a },
    { name: 'Thailand', region: 'asia', soil: 'soil', tint: 0x7a5a3a },
    { name: 'Cambodia', region: 'asia', soil: 'dirt', tint: 0x8a6a4a },
    { name: 'Indonesia', region: 'asia', soil: 'soil', tint: 0x5a3a2a },
    { name: 'Nigeria', region: 'africa-me', soil: 'soil', tint: 0x8b4a23 },
    { name: 'Ethiopia', region: 'africa-me', soil: 'dirt', tint: 0x8a5c40 },
    { name: 'Colombia', region: 'americas', soil: 'soil', tint: 0x6e4f33 },
    { name: 'Brazil', region: 'americas', soil: 'soil', tint: 0x7a3f1f },
    { name: 'United States', region: 'americas', soil: 'sand', tint: 0x9a7a5a },
    { name: 'Australia', region: 'americas', soil: 'sand', tint: 0xc0702f },
    { name: 'Norway', region: 'europe', soil: 'dirt', tint: 0x5f5a52 },
    { name: 'Sweden', region: 'europe', soil: 'soil', tint: 0x4f5546 },
    { name: 'Denmark', region: 'europe', soil: 'soil', tint: 0x62564a },
];

export const SITE_NAMES = SITES.map(s => s.name);

export function getSite(name) {
    return SITES.find(s => s.name === name) || null;
}

export function sitesInRegion(regionId) {
    if (!regionId || regionId === 'world') return SITES.slice();
    return SITES.filter(s => s.region === regionId);
}

// Every country players may guess. Deliberately much larger than SITES so the
// autocomplete never hints at which countries are in play.
export const ALL_COUNTRIES = [
    'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Antigua and Barbuda', 'Argentina',
    'Armenia', 'Australia', 'Austria', 'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados',
    'Belarus', 'Belgium', 'Belize', 'Benin', 'Bhutan', 'Bolivia', 'Bosnia and Herzegovina', 'Botswana',
    'Brazil', 'Brunei', 'Bulgaria', 'Burkina Faso', 'Burundi', 'Cambodia', 'Cameroon', 'Canada',
    'Cape Verde', 'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia', 'Comoros',
    'Costa Rica', 'Croatia', 'Cuba', 'Cyprus', 'Czech Republic', 'Democratic Republic of the Congo',
    'Denmark', 'Djibouti', 'Dominica', 'Dominican Republic', 'East Timor', 'Ecuador', 'Egypt',
    'El Salvador', 'Equatorial Guinea', 'Eritrea', 'Estonia', 'Eswatini', 'Ethiopia', 'Fiji', 'Finland',
    'France', 'Gabon', 'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece', 'Grenada', 'Guatemala',
    'Guinea', 'Guinea-Bissau', 'Guyana', 'Haiti', 'Honduras', 'Hungary', 'Iceland', 'India', 'Indonesia',
    'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy', 'Ivory Coast', 'Jamaica', 'Japan', 'Jordan',
    'Kazakhstan', 'Kenya', 'Kiribati', 'Kosovo', 'Kuwait', 'Kyrgyzstan', 'Laos', 'Latvia', 'Lebanon',
    'Lesotho', 'Liberia', 'Libya', 'Liechtenstein', 'Lithuania', 'Luxembourg', 'Madagascar', 'Malawi',
    'Malaysia', 'Maldives', 'Mali', 'Malta', 'Marshall Islands', 'Mauritania', 'Mauritius', 'Mexico',
    'Micronesia', 'Moldova', 'Monaco', 'Mongolia', 'Montenegro', 'Morocco', 'Mozambique', 'Myanmar',
    'Namibia', 'Nauru', 'Nepal', 'Netherlands', 'New Zealand', 'Nicaragua', 'Niger', 'Nigeria',
    'North Korea', 'North Macedonia', 'Norway', 'Oman', 'Pakistan', 'Palau', 'Palestine', 'Panama',
    'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines', 'Poland', 'Portugal', 'Qatar',
    'Republic of the Congo', 'Romania', 'Russia', 'Rwanda', 'Saint Kitts and Nevis', 'Saint Lucia',
    'Saint Vincent and the Grenadines', 'Samoa', 'San Marino', 'Sao Tome and Principe', 'Saudi Arabia',
    'Senegal', 'Serbia', 'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia',
    'Solomon Islands', 'Somalia', 'South Africa', 'South Korea', 'South Sudan', 'Spain', 'Sri Lanka',
    'Sudan', 'Suriname', 'Sweden', 'Switzerland', 'Syria', 'Taiwan', 'Tajikistan', 'Tanzania',
    'Thailand', 'Togo', 'Tonga', 'Trinidad and Tobago', 'Tunisia', 'Turkey', 'Turkmenistan', 'Tuvalu',
    'Uganda', 'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States', 'Uruguay',
    'Uzbekistan', 'Vanuatu', 'Vatican City', 'Venezuela', 'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe',
];

// Common alternative names → canonical name.
const ALIASES = {
    'United Kingdom': ['uk', 'u k', 'great britain', 'britain', 'england', 'scotland', 'wales', 'northern ireland'],
    'United States': ['usa', 'us', 'u s', 'u s a', 'united states of america', 'america'],
    'South Korea': ['korea', 'republic of korea'],
    'North Korea': ['dprk', 'democratic peoples republic of korea'],
    'Netherlands': ['holland', 'the netherlands'],
    'Iran': ['persia'],
    'Thailand': ['siam'],
    'Ethiopia': ['abyssinia'],
    'Cambodia': ['kampuchea'],
    'Turkey': ['turkiye'],
    'Russia': ['russian federation'],
    'Czech Republic': ['czechia'],
    'Myanmar': ['burma'],
    'Ivory Coast': ['cote divoire', 'cote d ivoire'],
    'China': ['prc', 'peoples republic of china'],
    'Eswatini': ['swaziland'],
    'North Macedonia': ['macedonia'],
    'Democratic Republic of the Congo': ['dr congo', 'drc', 'congo kinshasa'],
    'Republic of the Congo': ['congo', 'congo brazzaville'],
    'Vatican City': ['holy see', 'vatican'],
    'Sri Lanka': ['ceylon'],
    'East Timor': ['timor leste'],
    'United Arab Emirates': ['uae', 'emirates'],
    'Bosnia and Herzegovina': ['bosnia'],
    'Cape Verde': ['cabo verde'],
    'Sao Tome and Principe': ['sao tome'],
    'Mexico': ['mejico'],
};

export function normalizeName(input) {
    return String(input ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/['’`]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .replace(/^the /, '');
}

const LOOKUP = new Map();
for (const name of ALL_COUNTRIES) LOOKUP.set(normalizeName(name), name);
for (const [name, aliases] of Object.entries(ALIASES)) {
    for (const alias of aliases) LOOKUP.set(normalizeName(alias), name);
}

/** Resolve free text ("usa", "Holland", "côte d'ivoire") to a canonical country name, or null. */
export function resolveCountry(input) {
    const key = normalizeName(input);
    if (!key) return null;
    return LOOKUP.get(key) || null;
}

export function isCorrectGuess(input, answer) {
    const resolved = resolveCountry(input);
    return !!resolved && resolved === answer;
}

/**
 * Autocomplete suggestions. Prefix matches rank first, then word-prefix, then alias, then substring.
 * Returns [{ name, alias? }].
 */
export function searchCountries(query, limit = 6) {
    const q = normalizeName(query);
    if (!q) return [];
    const scored = new Map();
    const consider = (name, score, alias) => {
        const prev = scored.get(name);
        if (!prev || prev.score > score) scored.set(name, { name, score, alias });
    };
    for (const name of ALL_COUNTRIES) {
        const n = normalizeName(name);
        if (n === q) consider(name, 0);
        else if (n.startsWith(q)) consider(name, 1);
        else if (n.split(' ').some(w => w.startsWith(q))) consider(name, 2);
        else if (q.length >= 3 && n.includes(q)) consider(name, 4);
    }
    for (const [name, aliases] of Object.entries(ALIASES)) {
        for (const alias of aliases) {
            const a = normalizeName(alias);
            if (a === q) consider(name, 0.5, alias);
            else if (q.length >= 2 && a.startsWith(q)) consider(name, 3, alias);
        }
    }
    return [...scored.values()]
        .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name))
        .slice(0, limit)
        .map(({ name, alias }) => (alias ? { name, alias } : { name }));
}
