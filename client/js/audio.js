// ============================================
// AUDIO — Web Audio SFX (sampled + synthesized) and streamed music.
// Nothing here blocks startup: files load in the background after the
// first user gesture, and every call is a no-op until audio is ready.
// ============================================

import { settings } from './settings.js';

const SAMPLES = {
    dig: '/public/sounds/digging.wav',
    toss: '/public/sounds/throwing_dirt.wav',
    treasure: '/public/sounds/find_treasure.wav',
    correct: '/public/sounds/correct.wav',
    wrong: '/public/sounds/incorrect.wav',
    notify: '/public/sounds/notification.wav',
    click: '/public/sounds/clicking.wav',
    tick: '/public/sounds/countdown-singlesound.mp3',
};

const TRACKS = {
    menu: { src: '/public/sounds/intro_main.mp3', level: 0.75 },
    game: { src: '/public/sounds/intro_sound1.mp3', level: 0.55 },
    ambience: { src: '/public/sounds/bonfire.mp3', level: 0.35, sfx: true },
};

class Audio {
    constructor() {
        this.ctx = null;
        this.buffers = {};
        this.noise = null;
        this.tracks = {};
        this.wantMusic = null; // 'menu' | 'game' | null
        this.unlocked = false;
        this.lastTick = -1;

        const unlock = () => this.unlock();
        window.addEventListener('pointerdown', unlock, { capture: true });
        window.addEventListener('keydown', unlock, { capture: true });
        settings.onChange(key => {
            if (['master', 'music', 'sfx', 'muted'].includes(key)) this.applyVolumes();
        });
    }

    unlock() {
        if (this.unlocked) {
            if (this.ctx?.state === 'suspended') this.ctx.resume().catch(() => {});
            return;
        }
        this.unlocked = true;
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            this.ctx = new Ctx();
            this.master = this.ctx.createGain();
            this.sfxBus = this.ctx.createGain();
            this.sfxBus.connect(this.master);
            this.master.connect(this.ctx.destination);
            this.noise = this.makeNoise();
            this.applyVolumes();
            this.loadSamples();
        } catch (e) {
            console.warn('[Audio] Web Audio unavailable', e);
        }
        if (this.wantMusic) this.playMusic(this.wantMusic);
    }

    async loadSamples() {
        for (const [name, url] of Object.entries(SAMPLES)) {
            try {
                const res = await fetch(url);
                if (!res.ok) continue;
                const data = await res.arrayBuffer();
                this.buffers[name] = await this.ctx.decodeAudioData(data);
            } catch { /* missing or undecodable sample — synthesized fallback is used */ }
        }
    }

    makeNoise() {
        const len = this.ctx.sampleRate;
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        return buf;
    }

    get sfxLevel() {
        return settings.get('muted') ? 0 : settings.get('master') * settings.get('sfx');
    }

    get musicLevel() {
        return settings.get('muted') ? 0 : settings.get('master') * settings.get('music');
    }

    applyVolumes() {
        if (this.ctx) {
            this.master.gain.setTargetAtTime(settings.get('muted') ? 0 : settings.get('master'), this.ctx.currentTime, 0.05);
            this.sfxBus.gain.setTargetAtTime(settings.get('sfx'), this.ctx.currentTime, 0.05);
        }
        for (const [name, t] of Object.entries(this.tracks)) {
            if (!t.el.paused && !t.fading) t.el.volume = this.trackVolume(name);
        }
    }

    trackVolume(name) {
        const def = TRACKS[name];
        const base = def.sfx ? this.sfxLevel : this.musicLevel;
        return Math.min(1, base * def.level);
    }

    toggleMute() {
        settings.set('muted', !settings.get('muted'));
        if (!settings.get('muted') && this.wantMusic) this.playMusic(this.wantMusic);
        return settings.get('muted');
    }

    // ---------------- music ----------------

    track(name) {
        if (!this.tracks[name]) {
            const el = new window.Audio();
            el.src = TRACKS[name].src;
            el.loop = true;
            el.preload = 'none';
            this.tracks[name] = { el, fading: null };
        }
        return this.tracks[name];
    }

    playMusic(which) {
        this.wantMusic = which;
        if (!this.unlocked) return;
        const want = which === 'menu' ? ['menu', 'ambience'] : which === 'game' ? ['game'] : [];
        for (const name of Object.keys(TRACKS)) {
            if (want.includes(name)) this.fadeIn(name);
            else if (this.tracks[name]) this.fadeOut(name);
        }
    }

    stopMusic() { this.playMusic(null); }

    fadeIn(name) {
        const t = this.track(name);
        const target = this.trackVolume(name);
        if (!t.el.paused && !t.fading) { t.el.volume = target; return; }
        if (t.el.paused) {
            t.el.volume = 0;
            if (name === 'game') t.el.currentTime = 0;
            t.el.play().catch(() => {});
        }
        this.ramp(t, target, 900);
    }

    fadeOut(name) {
        const t = this.tracks[name];
        if (!t || t.el.paused) return;
        this.ramp(t, 0, 600, () => t.el.pause());
    }

    ramp(t, to, ms, done) {
        if (t.fading) cancelAnimationFrame(t.fading);
        const from = t.el.volume;
        const start = performance.now();
        const step = now => {
            const k = Math.min(1, (now - start) / ms);
            t.el.volume = Math.max(0, Math.min(1, from + (to - from) * k));
            if (k < 1) t.fading = requestAnimationFrame(step);
            else { t.fading = null; done?.(); }
        };
        t.fading = requestAnimationFrame(step);
    }

    setUrgent(on) {
        const t = this.tracks.game;
        if (t) t.el.playbackRate = on ? 1.12 : 1;
    }

    // ---------------- primitives ----------------

    get ready() { return !!this.ctx && this.sfxLevel > 0; }

    sample(name, { gain = 1, rate = 1, delay = 0 } = {}) {
        const buf = this.buffers[name];
        if (!this.ready || !buf) return false;
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.playbackRate.value = rate;
        const g = this.ctx.createGain();
        g.gain.value = gain;
        src.connect(g).connect(this.sfxBus);
        src.start(this.ctx.currentTime + delay);
        return true;
    }

    noiseBurst({ dur = 0.2, type = 'bandpass', freq = 1200, freqEnd = freq, q = 1, gain = 0.4, attack = 0.005, delay = 0 }) {
        if (!this.ready) return;
        const t0 = this.ctx.currentTime + delay;
        const src = this.ctx.createBufferSource();
        src.buffer = this.noise;
        src.loop = true;
        const filter = this.ctx.createBiquadFilter();
        filter.type = type;
        filter.Q.value = q;
        filter.frequency.setValueAtTime(freq, t0);
        filter.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + dur);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        src.connect(filter).connect(g).connect(this.sfxBus);
        src.start(t0, Math.random() * 0.5);
        src.stop(t0 + dur + 0.05);
    }

    tone({ freq = 440, freqEnd, type = 'sine', dur = 0.3, gain = 0.2, attack = 0.005, delay = 0 }) {
        if (!this.ready) return;
        const t0 = this.ctx.currentTime + delay;
        const osc = this.ctx.createOscillator();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t0);
        if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(g).connect(this.sfxBus);
        osc.start(t0);
        osc.stop(t0 + dur + 0.05);
    }

    // ---------------- game sounds ----------------

    click() {
        if (!this.sample('click', { gain: 0.35 })) this.tone({ freq: 1400, dur: 0.04, gain: 0.05, type: 'triangle' });
    }

    hover() { this.tone({ freq: 2200, dur: 0.025, gain: 0.015, type: 'triangle' }); }

    toolSwitch() {
        this.noiseBurst({ dur: 0.08, type: 'highpass', freq: 3000, gain: 0.08 });
        this.tone({ freq: 660, dur: 0.07, gain: 0.04, type: 'triangle' });
    }

    shovel(layer = 0) {
        const rate = 1.05 - layer * 0.07 + (Math.random() - 0.5) * 0.08;
        if (!this.sample('dig', { gain: 0.8, rate })) this.noiseBurst({ dur: 0.3, type: 'lowpass', freq: 900, freqEnd: 200, gain: 0.5 });
        this.tone({ freq: 90 - layer * 8, freqEnd: 45, dur: 0.18, gain: 0.25 });
    }

    toss() { this.sample('toss', { gain: 0.45, rate: 0.95 + Math.random() * 0.1 }); }

    trowel(layer = 0) {
        const f = 1900 - layer * 250;
        this.noiseBurst({ dur: 0.16, freq: f, freqEnd: f * 0.55, q: 2.2, gain: 0.32 });
        this.noiseBurst({ dur: 0.14, freq: f * 1.1, freqEnd: f * 0.6, q: 2.2, gain: 0.26, delay: 0.14 });
        this.tone({ freq: 140, freqEnd: 70, dur: 0.1, gain: 0.08 });
    }

    brush(progress = 0) {
        this.noiseBurst({ dur: 0.32, type: 'highpass', freq: 2500 + progress * 1500, freqEnd: 5200, gain: 0.22, attack: 0.08 });
        this.noiseBurst({ dur: 0.26, type: 'highpass', freq: 3200, freqEnd: 6000, gain: 0.14, attack: 0.06, delay: 0.16 });
    }

    probe(count) {
        [1568, 2349, 3136].forEach((f, i) => this.tone({ freq: f, dur: 0.45 - i * 0.1, gain: 0.07, type: 'triangle' }));
        const ping = count > 0 ? 880 : 440;
        this.tone({ freq: ping, dur: 0.6, gain: 0.08, delay: 0.18 });
        if (count > 1) this.tone({ freq: ping * 1.5, dur: 0.5, gain: 0.06, delay: 0.32 });
    }

    bedrock() {
        this.tone({ freq: 220, freqEnd: 180, dur: 0.18, gain: 0.12, type: 'square' });
        this.noiseBurst({ dur: 0.12, type: 'bandpass', freq: 2600, gain: 0.15 });
    }

    damage() {
        this.noiseBurst({ dur: 0.12, freq: 3400, freqEnd: 1800, q: 6, gain: 0.35 });
        this.tone({ freq: 520, freqEnd: 240, dur: 0.25, gain: 0.08, type: 'sawtooth' });
    }

    expose() {
        this.tone({ freq: 1046, dur: 0.5, gain: 0.07, type: 'triangle' });
        this.tone({ freq: 1568, dur: 0.6, gain: 0.05, delay: 0.08 });
    }

    /** Rarity-scaled discovery fanfare. rank: 0 common … 3 legendary */
    discovery(rank = 0) {
        const scales = [
            [784, 1175],
            [784, 988, 1175],
            [659, 831, 988, 1319],
            [587, 740, 880, 1175, 1480, 1760],
        ];
        const notes = scales[rank] || scales[0];
        notes.forEach((f, i) => {
            this.tone({ freq: f, dur: 0.9 + rank * 0.25, gain: 0.07 + rank * 0.012, delay: i * (0.09 + rank * 0.015), type: 'triangle' });
            this.tone({ freq: f * 2, dur: 0.6, gain: 0.025, delay: i * (0.09 + rank * 0.015) });
        });
        if (rank >= 1) this.sample('treasure', { gain: 0.35 + rank * 0.15 });
        if (rank >= 3) this.tone({ freq: 2400, freqEnd: 4800, dur: 1.6, gain: 0.03, delay: 0.35 });
    }

    correct() { if (!this.sample('correct', { gain: 0.55 })) this.discovery(1); }
    wrong() { if (!this.sample('wrong', { gain: 0.5 })) this.tone({ freq: 220, freqEnd: 140, dur: 0.5, gain: 0.15, type: 'sawtooth' }); }
    notify() { if (!this.sample('notify', { gain: 0.45 })) this.tone({ freq: 880, dur: 0.25, gain: 0.08 }); }
    /** Soft paper tick as a catalogue line is written. */
    tick(i = 0) { this.noiseBurst({ dur: 0.035, type: 'highpass', freq: 2600 + i * 140, gain: 0.05 }); }

    /** The held breath before a rare find comes free. */
    hush(rank = 2) {
        this.tone({ freq: 55, freqEnd: 82, dur: 0.9, gain: 0.06 + rank * 0.02, attack: 0.25 });
        this.noiseBurst({ dur: 0.7, type: 'bandpass', freq: 400, freqEnd: 1800, q: 2, gain: 0.05, attack: 0.3 });
    }

    stamp() { this.tone({ freq: 110, freqEnd: 50, dur: 0.22, gain: 0.3 }); this.noiseBurst({ dur: 0.1, type: 'lowpass', freq: 600, gain: 0.25 }); }

    countdown(secondsLeft) {
        if (secondsLeft > 10 || secondsLeft <= 0 || secondsLeft === this.lastTick) return;
        this.lastTick = secondsLeft;
        const rate = secondsLeft <= 3 ? 1 + (4 - secondsLeft) * 0.06 : 1;
        const gain = 0.35 + (10 - secondsLeft) * 0.04;
        if (!this.sample('tick', { gain, rate })) this.tone({ freq: 1200 * rate, dur: 0.06, gain: 0.08 });
    }

    resetCountdown() { this.lastTick = -1; }
}

export const audio = new Audio();
