// ============================================
// SETTINGS & PLAYER PROFILE — persisted in localStorage
// ============================================

const KEY = 'unearth_settings_v2';

export const PLAYER_COLORS = [
    { value: '#d9a93b', name: 'Brass' },
    { value: '#c4683f', name: 'Terracotta' },
    { value: '#df6a4f', name: 'Cinnabar' },
    { value: '#96b57b', name: 'Verdigris' },
    { value: '#4fb3a4', name: 'Turquoise' },
    { value: '#7c9be0', name: 'Lapis' },
    { value: '#a98bd8', name: 'Amethyst' },
    { value: '#e48fb0', name: 'Rose quartz' },
    { value: '#e8e1cf', name: 'Ivory' },
    { value: '#8a6a4a', name: 'Umber' },
];

const prefersReducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const DEFAULTS = {
    master: 0.7,
    music: 0.45,
    sfx: 0.8,
    muted: false,
    particles: true,
    shake: true,
    reducedMotion: prefersReducedMotion,
    tips: true,
    name: '',
    color: PLAYER_COLORS[0].value,
    lastSolo: { region: 'world', rounds: 5, time: 120 },
};

function safeRead(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}

function migrateLegacy() {
    // v1.0.0 stored these separately.
    const out = {};
    const audio = safeRead('unearth_audio_prefs');
    if (audio) {
        if (typeof audio.masterVolume === 'number') out.master = audio.masterVolume;
        if (typeof audio.musicVolume === 'number') out.music = audio.musicVolume;
        if (typeof audio.sfxVolume === 'number') out.sfx = audio.sfxVolume;
    }
    const visual = safeRead('unearth_settings');
    if (visual) {
        if (typeof visual.particlesEnabled === 'boolean') out.particles = visual.particlesEnabled;
        if (typeof visual.screenShakeEnabled === 'boolean') out.shake = visual.screenShakeEnabled;
    }
    try {
        const name = localStorage.getItem('unearth_name');
        if (name) out.name = name.slice(0, 20);
        const color = localStorage.getItem('unearth_color');
        if (color && /^#[0-9a-f]{6}$/i.test(color)) out.color = color;
    } catch { /* storage unavailable */ }
    return out;
}

class Settings {
    constructor() {
        const saved = safeRead(KEY);
        this.data = { ...DEFAULTS, ...(saved || migrateLegacy()) };
        this.listeners = new Set();
    }

    get(key) { return this.data[key]; }

    set(key, value) {
        if (this.data[key] === value) return;
        this.data[key] = value;
        this.save();
        this.listeners.forEach(fn => fn(key, value));
    }

    patch(obj) {
        Object.assign(this.data, obj);
        this.save();
        Object.entries(obj).forEach(([k, v]) => this.listeners.forEach(fn => fn(k, v)));
    }

    onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

    save() {
        try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* private mode */ }
    }

    get playerName() { return (this.data.name || '').trim() || 'Explorer'; }
}

export const settings = new Settings();
