// ============================================
// PROGRESS — the player's Archive (catalogued artifacts), ranks and records
// ============================================

import { ALL_ARTIFACTS, CATALOG, getArtifact, estimateValue } from './data/catalog.js';
import { CONDITIONS } from './game/site.js';

const KEY = 'unearth_archive_v1';

export const RANKS = [
    { min: 0, name: 'Volunteer', seal: 'I' },
    { min: 5, name: 'Field Assistant', seal: 'II' },
    { min: 15, name: 'Excavator', seal: 'III' },
    { min: 35, name: 'Site Supervisor', seal: 'IV' },
    { min: 70, name: 'Field Director', seal: 'V' },
    { min: 120, name: 'Chief Curator', seal: 'VI' },
    { min: 200, name: 'Keeper of Antiquities', seal: 'VII' },
    { min: ALL_ARTIFACTS.length, name: 'Legend of the Field', seal: 'VIII' },
];

function blank() {
    return {
        finds: {},
        stats: { expeditions: 0, sites: 0, correct: 0, finds: 0, legendary: 0, bestScore: 0, bestStreak: 0 },
        daily: {},
        tipsSeen: {},
    };
}

class Progress {
    constructor() {
        this.data = blank();
        try {
            const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
            if (saved) this.data = { ...blank(), ...saved, stats: { ...blank().stats, ...saved.stats } };
            else {
                const legacyBest = parseInt(localStorage.getItem('unearth_personal_best') || '0', 10);
                if (legacyBest > 0) this.data.stats.bestScore = legacyBest;
            }
        } catch { /* corrupted or unavailable storage */ }
    }

    save() {
        try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* private mode */ }
    }

    // ---- artifacts ----

    has(id) { return !!this.data.finds[id]; }
    entry(id) { return this.data.finds[id] || null; }

    /** Catalogue a recovered find. Returns { isNew, improved }. */
    recordFind(find) {
        const id = find.entry.id;
        const prev = this.data.finds[id];
        this.data.stats.finds++;
        if (find.entry.rarity === 'legendary') this.data.stats.legendary++;
        if (!prev) {
            this.data.finds[id] = { first: Date.now(), best: find.condition, count: 1, unseen: true };
            this.save();
            return { isNew: true, improved: false };
        }
        prev.count++;
        const improved = find.condition < prev.best;
        if (improved) prev.best = find.condition;
        this.save();
        return { isNew: false, improved };
    }

    markSeen(id) {
        const e = this.data.finds[id];
        if (e?.unseen) { e.unseen = false; this.save(); }
    }

    get uniqueCount() { return Object.keys(this.data.finds).length; }
    get unseenCount() { return Object.values(this.data.finds).filter(e => e.unseen).length; }

    countryProgress(country) {
        const list = CATALOG[country] || [];
        return { found: list.filter(a => this.has(a.id)).length, total: list.length };
    }

    totalValue() {
        let sum = 0;
        for (const [id, rec] of Object.entries(this.data.finds)) {
            const entry = getArtifact(id);
            if (entry) sum += estimateValue(entry, CONDITIONS[rec.best]?.factor ?? 1);
        }
        return sum;
    }

    rank(count = this.uniqueCount) {
        let index = 0;
        RANKS.forEach((r, i) => { if (count >= r.min) index = i; });
        const current = RANKS[index];
        const next = RANKS[index + 1] || null;
        const progress = next ? (count - current.min) / (next.min - current.min) : 1;
        return { index, ...current, next, progress, count };
    }

    // ---- runs ----

    recordSite(correct) {
        this.data.stats.sites++;
        if (correct) this.data.stats.correct++;
        this.save();
    }

    recordExpedition({ score, streak }) {
        const s = this.data.stats;
        s.expeditions++;
        const prevBest = s.bestScore;
        if (score > s.bestScore) s.bestScore = score;
        if (streak > s.bestStreak) s.bestStreak = streak;
        this.save();
        return { prevBest, isBest: score > prevBest && score > 0 };
    }

    get stats() { return this.data.stats; }

    dailyResult(day) { return this.data.daily[day] || null; }
    setDailyResult(day, result) {
        this.data.daily[day] = result;
        // keep the last 60 days only
        const days = Object.keys(this.data.daily).map(Number).sort((a, b) => b - a);
        days.slice(60).forEach(d => delete this.data.daily[d]);
        this.save();
    }

    tipSeen(id) { return !!this.data.tipsSeen[id]; }
    markTip(id) { this.data.tipsSeen[id] = true; this.save(); }
    resetTips() { this.data.tipsSeen = {}; this.save(); }

    reset() {
        this.data = blank();
        this.save();
    }
}

export const progress = new Progress();
