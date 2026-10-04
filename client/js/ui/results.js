// ============================================
// RESULTS — the site report after each round and the expedition report at
// the end, both written up as field documents.
// ============================================

import { $, h, clear, icon, fmtInt, dialogs, toast } from './dom.js';
import { RARITIES, formatYear } from '../data/catalog.js';
import { CONDITIONS } from '../game/site.js';
import { basePoints, WRONG_GUESS_PENALTY } from '../shared/rules.js';
import { progress, RANKS } from '../progress.js';
import { audio } from '../audio.js';
import { lobby } from '../net/lobby.js';

let countdownTimer = null;
const pad = n => String(n).padStart(2, '0');

/** Big centred numerals — the multiplayer countdown. */
export function banner(title, _kind = '', sub = '') {
    const el = h('div.banner', { role: 'presentation' }, h('div.t', title), sub ? h('div.s', sub) : null);
    document.body.append(el);
    setTimeout(() => el.remove(), 1000);
}

function catRow(find, thumbs, onInspect, i) {
    const entry = find.entry;
    const isNew = progress.entry(entry.id)?.unseen;
    const thumb = thumbs.get(entry.id);
    return h('button.cat-row', { type: 'button', style: { animationDelay: `${160 + i * 80}ms` }, onclick: () => onInspect(find), 'aria-label': `Inspect ${entry.name}` },
        h('span.thumb', thumb ? h('img', { src: thumb, alt: '' }) : icon('pot')),
        h('span.t',
            h('strong', entry.name),
            h('small', `${entry.culture} · ${entry.period} · ${formatYear(entry.year)}`),
            h('small.note', entry.note)),
        h('span.side',
            h('span', { class: `rarity rarity-${entry.rarity}` }, RARITIES[entry.rarity].label),
            isNew ? h('span.tag.new', 'New') : null,
            find.condition >= 3 ? h('span.tag.bad', CONDITIONS[find.condition].label) : null));
}

const ledger = (...rows) => h('div.ledger', ...rows.filter(Boolean).map(([k, v, cls = '', total = false]) =>
    h('div.lg-row', { class: total ? 'total' : '' }, h('span.k', k), h('span.lead'), h('span', { class: `v ${cls}` }, v))));

/**
 * Site report.
 * opts: { entry (log entry), site, thumbs, score, index, total, last, onContinue, onInspect, multi (server round_end) }
 */
export function showRoundResults({ entry, site, thumbs, score, index, total, last, onContinue, onInspect, multi }) {
    clearInterval(countdownTimer);
    const body = clear($('#rr-body'));
    const correct = entry.correct;

    body.append(h('header.doc-head.slim',
        h('span.doc-code', `Site report · ${pad(index)} / ${pad(total)}`),
        h('span.doc-no', `Grid 8×8 · ref ${String(site.seed).slice(-5)}`)));

    body.append(h('div.verdict',
        h('span.verdict-k', 'This excavation was in'),
        h('h2.verdict-country#rr-country', site.country),
        entry.guess && !correct ? h('span.verdict-yours', `You said ${entry.guess}`) : null,
        h('span', { class: `stamp ${correct ? '' : 'bad'}` }, correct ? 'Identified' : entry.timeout ? 'Time’s up' : 'Misidentified')));

    const remaining = site.finds.length - entry.finds.length;
    body.append(h('h3.section-h', 'Catalogued from this site ', h('b', `${entry.finds.length}/${site.finds.length}`)));
    if (entry.finds.length) {
        const list = h('div.catalogue-list');
        entry.finds.forEach((f, i) => list.append(catRow(f, thumbs, onInspect, i)));
        body.append(list);
    } else {
        body.append(h('p.dim-line', correct ? 'A blind identification — no finds disturbed. Impressive.' : 'Nothing recovered — every artifact is a clue.'));
    }
    if (remaining > 0) body.append(h('p.dim-line', `${remaining} more find${remaining === 1 ? '' : 's'} stayed in the ground — maybe next season.`));

    if (!multi) {
        const base = basePoints(entry.recovered);
        const bonus = correct ? entry.points - base : 0;
        body.append(h('h3.section-h', 'Field accounts'),
            ledger(
                correct ? [`Identification · ${entry.recovered} find${entry.recovered === 1 ? '' : 's'}`, fmtInt(base)] : null,
                correct ? ['Time bonus', `+${fmtInt(bonus)}`] : null,
                !correct && !entry.timeout ? ['Wrong identification', `−${WRONG_GUESS_PENALTY}`, 'neg'] : null,
                entry.timeout ? ['No identification', '0'] : null,
                ['This site', entry.points > 0 ? `+${fmtInt(entry.points)}` : entry.points < 0 ? `−${fmtInt(-entry.points)}` : '0', entry.points > 0 ? 'pos' : entry.points < 0 ? 'neg' : ''],
                ['Expedition total', fmtInt(score), '', true]));
        const btn = h('button.btn.btn-primary.btn-lg', { type: 'button' }, last ? 'Expedition report' : 'Next site', icon('chevron'));
        btn.addEventListener('click', () => dialogs.close('round-results'));
        body.append(h('footer.doc-foot', btn));
    } else {
        const rows = h('div.mini-standings');
        const byId = new Map(multi.results.map(r => [r.playerId, r]));
        multi.standings.forEach((p, i) => {
            const r = byId.get(p.id);
            const pts = r ? r.points : 0;
            rows.append(h('div.ms-row', { class: p.id === lobby.playerId ? 'me' : '' },
                h('span.rk', pad(i + 1)),
                h('span.dot', { style: { '--c': p.color } }),
                h('span.n', p.name),
                h('span', { class: `pts v ${pts > 0 ? 'pos' : pts < 0 ? 'neg' : ''}` }, r?.isTimeout ? 'no guess' : pts > 0 ? `+${pts}` : pts < 0 ? `${pts}` : '0'),
                h('span.tot', fmtInt(p.score))));
        });
        body.append(h('h3.section-h', 'Standings'), rows);
        const line = h('p.countdown-line');
        body.append(line);
        let left = Math.round((multi.nextRoundIn || 0) / 1000);
        const render = () => { line.textContent = last ? 'Final report in a moment…' : `Next site in ${left}s`; };
        render();
        countdownTimer = setInterval(() => { left = Math.max(0, left - 1); render(); if (left <= 0) clearInterval(countdownTimer); }, 1000);
    }

    body.onkeydown = e => {
        if (!multi && e.key === 'Enter' && e.target === body) { e.preventDefault(); dialogs.close('round-results'); }
    };
    audio.stamp();
    dialogs.open('round-results', {
        onClose: () => {
            clearInterval(countdownTimer);
            if (!multi) onContinue?.();
        },
    });
}

/**
 * Expedition report.
 * run: summary from Expedition plus optional standings (multiplayer).
 * handlers: { onAgain, onMenu, onShare, submitScore }
 */
export function showFinal(run, { onAgain, onMenu, onShare, submitScore }) {
    const body = clear($('#final-body'));
    const rankBefore = progress.rank();
    const pb = run.mode === 'multi' ? { isBest: false } : progress.recordExpedition({ score: run.score, streak: run.bestStreak });
    if (run.mode === 'daily') {
        progress.setDailyResult(run.daily, {
            score: run.score, correct: run.correct, rounds: run.rounds, finds: run.finds, legendary: run.legendary,
            sites: run.sites.map(s => ({ correct: s.correct, recovered: s.recovered, legendary: s.legendary, country: s.country })),
        });
    }

    const code = run.mode === 'multi' ? 'Expedition report · multiplayer' : run.mode === 'daily' ? `Expedition report · Daily Dig #${run.daily}` : `Expedition report · ${run.regionLabel || 'Worldwide'}`;
    const title = run.mode === 'multi' ? 'Expedition results' : run.mode === 'daily' ? `Daily Dig #${run.daily}` : 'Expedition complete';
    body.append(h('header.doc-head',
        h('span.doc-code', code),
        h('span.doc-no', new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })),
        h('h2.doc-title#final-title', title)));

    if (run.standings?.length > 1) {
        const [a, b, c] = run.standings;
        const place = (p, cls, n) => (p ? h(`div.place.${cls}`,
            h('span.dot', { style: { '--c': p.color } }),
            h('span.pn', p.name), h('span.ps', fmtInt(p.score)), h('div.plinth', n)) : h('div'));
        const podium = c ? h('div.podium', place(b, 'second', 'II'), place(a, 'first', 'I'), place(c, 'third', 'III'))
            : h('div.podium', { style: { gridTemplateColumns: '1fr 1.15fr', maxWidth: '460px', margin: '6px auto 16px' } }, place(b, 'second', 'II'), place(a, 'first', 'I'));
        body.append(podium);
        if (run.standings.length > 3) {
            const rest = h('div.mini-standings');
            run.standings.slice(3).forEach((p, i) => rest.append(h('div.ms-row',
                h('span.rk', pad(i + 4)), h('span.dot', { style: { '--c': p.color } }), h('span.n', p.name), h('span'), h('span.tot', fmtInt(p.score)))));
            body.append(rest);
        }
    } else {
        body.append(h('div.report-score', h('span.k', 'Final score'), h('span.big', fmtInt(run.score))));
    }

    body.append(h('div.report-figures',
        fig(`${run.correct}/${run.rounds}`, 'Identified'),
        fig(fmtInt(run.finds), 'Finds'),
        fig(fmtInt(run.legendary), 'Legendary'),
        fig(fmtInt(run.bestStreak), 'Best streak')));

    const lines = h('div.report-lines');
    if (run.standings?.length > 1) {
        const myRank = run.standings.findIndex(p => p.id === lobby.playerId) + 1;
        if (myRank) lines.append(h('p.hi', myRank === 1 ? 'You led the expedition' : `You finished ${myRank} of ${run.standings.length}`));
    }
    if (pb.isBest) lines.append(h('p.hi', pb.prevBest > 0 ? `New personal best — previous ${fmtInt(pb.prevBest)}` : 'Your first recorded expedition'));
    else if (run.mode !== 'multi' && progress.stats.bestScore > 0) lines.append(h('p', `Personal best: ${fmtInt(progress.stats.bestScore)}`));
    body.append(lines);

    const rank = progress.rank();
    const promoted = rank.index > rankBefore.index;
    body.append(h('div.rank-line',
        h('span.seal', rank.seal),
        h('div.rl-body',
            h('div.rl-top', h('strong', rank.name),
                promoted ? h('span.tag.new', 'Promoted') : h('small', rank.next ? `${rank.next.min - rank.count} finds to ${rank.next.name}` : 'Highest rank')),
            h('span.ruler', { style: { '--value': rank.progress } }, h('span')),
            h('small', `${rank.count} of ${RANKS[RANKS.length - 1].min} artifacts catalogued`))));
    if (promoted) toast(`Promoted to ${rank.name}`, { type: 'gold', icon: 'sparkle', duration: 4000 });

    const log = h('div.site-log');
    run.sites.forEach((s, i) => log.append(h('div.sl-row',
        icon(s.correct ? 'check' : 'x', 'keep'),
        h('span.c', `${pad(i + 1)}  ${s.country}`),
        h('span.f', `${s.recovered} find${s.recovered === 1 ? '' : 's'}${s.legendary ? ' · legendary' : ''}`),
        h('span', { class: `p v ${s.points > 0 ? 'pos' : s.points < 0 ? 'neg' : ''}` }, s.points > 0 ? `+${fmtInt(s.points)}` : s.points < 0 ? `${s.points}` : '0'))));
    body.append(h('h3.section-h', 'Site log'), log);

    let routed = false;
    const go = fn => () => { routed = true; dialogs.close('final'); fn(); };
    body.append(h('footer.doc-foot.split',
        h('button.btn', { type: 'button', onclick: () => onShare(run) }, icon('share'), 'Share'),
        h('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } },
            h('button.btn', { type: 'button', onclick: go(onMenu) }, 'Base camp'),
            onAgain ? h('button.btn.btn-primary', { type: 'button', onclick: go(onAgain) }, icon(run.mode === 'multi' ? 'users' : 'shovel'), run.mode === 'multi' ? 'Back to lobby' : 'New expedition') : null)));

    // Esc / backdrop close returns to base camp
    dialogs.open('final', { onClose: () => { if (!routed) onMenu?.(); } });
    audio.stamp();

    if (submitScore) {
        submitScore().then(res => {
            if (res?.rank) lines.append(h('p.hi', `#${res.rank} on the worldwide leaderboard`));
        }).catch(() => {});
    }
}

function fig(v, k) {
    return h('div', h('span.v', v), h('span.k', k));
}
