// ============================================
// RESULTS — round verdicts, expedition summary, celebratory banners.
// ============================================

import { $, h, clear, svgIcon, fmtInt, dialogs, initials, toast } from './dom.js';
import { RARITIES, formatYear } from '../data/catalog.js';
import { CONDITIONS, displayName } from '../game/site.js';
import { basePoints, WRONG_GUESS_PENALTY } from '../shared/rules.js';
import { progress, RANKS } from '../progress.js';
import { settings } from '../settings.js';
import { audio } from '../audio.js';
import { lobby } from '../net/lobby.js';

let countdownTimer = null;

export function banner(title, kind = 'legendary', sub = '') {
    const el = h('div.banner', { role: 'presentation' },
        h('div.t', { style: kind === 'rare' ? { color: 'var(--r-rare)', textShadow: '0 0 30px rgba(110,170,240,.6)' } : null }, title),
        sub ? h('div.s', sub) : null);
    document.body.append(el);
    setTimeout(() => el.remove(), 2700);
}

export function legendaryBanner() {
    banner('Legendary find', 'legendary', 'A once-in-a-lifetime discovery');
    if (!settings.get('reducedMotion')) {
        const v = h('div.vignette-flash');
        document.body.append(v);
        setTimeout(() => v.remove(), 1700);
    }
}

function findRow(find, thumbs, onInspect, i) {
    const entry = find.entry;
    const isNew = progress.entry(entry.id)?.unseen;
    return h('button.find-row', { type: 'button', style: { animationDelay: `${120 + i * 70}ms` }, onclick: () => onInspect(find) },
        thumbs.get(entry.id) ? h('img', { src: thumbs.get(entry.id), alt: '' }) : h('span'),
        h('span.t',
            h('strong', entry.name),
            h('small', `${entry.culture} · ${entry.period} · ${formatYear(entry.year)}`),
            h('small', entry.note)),
        h('span.side',
            h('span', { class: `rarity rarity-${entry.rarity}` }, RARITIES[entry.rarity].label),
            isNew ? h('span.badge.new', 'New') : null,
            find.condition >= 3 ? h('span.badge.bad', CONDITIONS[find.condition].label) : null));
}

/**
 * Round verdict dialog.
 * opts: { entry (log entry), site, thumbs, score, last, onContinue, onInspect, multi (server round_end) }
 */
export function showRoundResults({ entry, site, thumbs, score, last, onContinue, onInspect, multi }) {
    clearInterval(countdownTimer);
    const body = clear($('#rr-body'));
    const correct = entry.correct;
    const stampClass = correct ? 'ok' : 'bad';
    const stampText = correct ? 'Site identified' : entry.timeout ? 'Time’s up' : 'Misidentified';

    body.append(h('div.verdict',
        h('span', { class: `stamp ${stampClass}` }, svgIcon(correct ? 'check' : 'x'), stampText),
        h('span.kicker', 'This excavation was in'),
        h('h2.country#rr-country', site.country),
        entry.guess && !correct ? h('span.yours', `You said ${entry.guess}`) : null));

    if (!multi) {
        const base = basePoints(entry.recovered);
        const bonus = correct ? entry.points - base : 0;
        body.append(h('div.breakdown',
            h('div', h('span.k', `${entry.recovered} find${entry.recovered === 1 ? '' : 's'}`), h('span.v', correct ? fmtInt(base) : '—')),
            h('div', h('span.k', 'Time bonus'), h('span.v', correct ? `+${fmtInt(bonus)}` : '—')),
            h('div', h('span.k', 'This site'), h('span', { class: `v ${entry.points > 0 ? 'pos' : entry.points < 0 ? 'neg' : ''}` },
                entry.points > 0 ? `+${fmtInt(entry.points)}` : entry.points < 0 ? `−${WRONG_GUESS_PENALTY}` : '0')),
            h('div', h('span.k', 'Total'), h('span.v.pos', fmtInt(score)))));
    }

    const list = h('div.finds-list');
    entry.finds.forEach((f, i) => list.append(findRow(f, thumbs, onInspect, i)));
    const remaining = site.finds.length - entry.finds.length;
    body.append(h('div.stack', { style: { gap: '10px' } },
        h('span.kicker', entry.finds.length ? 'Catalogued from this site' : 'No finds recovered'),
        entry.finds.length ? list : h('p.dim', { style: { margin: 0 } }, correct
            ? 'A blind identification — impressive.'
            : 'Recover a find or two next time — every artifact is a clue.'),
        remaining > 0 ? h('p.muted', { style: { margin: 0, fontSize: '15px' } },
            `${remaining} more find${remaining === 1 ? '' : 's'} stayed in the ground — maybe next season.`) : null));

    const foot = h('div.modal-foot');
    if (multi) {
        const rows = h('div.mini-standings');
        const byId = new Map(multi.results.map(r => [r.playerId, r]));
        multi.standings.forEach((p, i) => {
            const r = byId.get(p.id);
            const pts = r ? r.points : 0;
            rows.append(h('div.r', { style: p.id === lobby.playerId ? { boxShadow: '0 0 0 1px var(--brass) inset' } : null },
                h('span.rk', `#${i + 1}`),
                h('span', { style: { display: 'flex', gap: '8px', alignItems: 'center', minWidth: 0 } },
                    h('span.avatar', { style: { '--c': p.color, width: '24px', height: '24px', fontSize: '11px' } }, initials(p.name)),
                    h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, p.name)),
                h('span', { class: `pts ${pts > 0 ? 'pos' : pts < 0 ? 'neg' : ''}` },
                    r?.isTimeout ? 'no guess' : pts > 0 ? `+${pts}` : pts < 0 ? `${pts}` : '0'),
                h('span.tot', fmtInt(p.score))));
        });
        body.append(h('div.stack', { style: { gap: '10px' } }, h('span.kicker', 'Standings'), rows));
        const line = h('p.countdown-line');
        body.append(line);
        let left = Math.round((multi.nextRoundIn || 0) / 1000);
        const render = () => { line.textContent = last ? 'Final results in a moment…' : `Next site in ${left}s`; };
        render();
        countdownTimer = setInterval(() => { left = Math.max(0, left - 1); render(); if (left <= 0) clearInterval(countdownTimer); }, 1000);
    } else {
        const btn = h('button.btn.btn-primary.btn-lg', { type: 'button' },
            last ? 'Expedition summary' : 'Next site', svgIcon('chevron'));
        btn.addEventListener('click', () => dialogs.close('round-results'));
        foot.append(btn);
        body.append(foot);
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
 * Expedition summary.
 * run: summary from Expedition plus optional standings (multiplayer).
 * handlers: { onAgain, onMenu, onShare }
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

    const title = run.mode === 'multi' ? 'Expedition results' : run.mode === 'daily' ? `Daily Dig #${run.daily}` : 'Expedition complete';
    body.append(h('div.modal-head',
        h('div.titles', h('span.kicker.brass', run.mode === 'multi' ? 'Multiplayer' : run.regionLabel || 'Worldwide'), h('h2.h1#final-title', title))));

    if (run.standings?.length > 1) {
        const [a, b, c] = run.standings;
        const place = (p, cls, n) => p ? h(`div.place.${cls}`,
            h('span.avatar', { style: { '--c': p.color } }, initials(p.name)),
            h('span.pn', p.name), h('span.ps', fmtInt(p.score)), h('div.plinth', n)) : h('div');
        const podium = c ? h('div.podium', place(b, 'second', '2'), place(a, 'first', '1'), place(c, 'third', '3'))
            : h('div.podium', { style: { gridTemplateColumns: '1fr 1.15fr', maxWidth: '460px', justifySelf: 'center', width: '100%' } }, place(b, 'second', '2'), place(a, 'first', '1'));
        body.append(podium);
        if (run.standings.length > 3) {
            const rest = h('div.mini-standings');
            run.standings.slice(3).forEach((p, i) => rest.append(h('div.r', h('span.rk', `#${i + 4}`), h('span', p.name), h('span'), h('span.tot', fmtInt(p.score)))));
            body.append(rest);
        }
        const myRank = run.standings.findIndex(p => p.id === lobby.playerId) + 1;
        if (myRank) body.append(h('p.highlight-line', myRank === 1 ? 'You led the expedition!' : `You finished #${myRank} of ${run.standings.length}`));
    } else {
        body.append(h('div.final-score', h('span.kicker', 'Final score'), h('span.big', fmtInt(run.score))));
    }

    body.append(h('div.stat-grid',
        tile(`${run.correct}/${run.rounds}`, 'Sites identified'),
        tile(fmtInt(run.finds), 'Finds recovered'),
        tile(fmtInt(run.legendary), 'Legendary finds'),
        tile(fmtInt(run.bestStreak), 'Best streak')));

    const highlight = h('p.highlight-line');
    if (pb.isBest) highlight.textContent = pb.prevBest > 0 ? `New personal best — previous ${fmtInt(pb.prevBest)}` : 'Your first recorded expedition!';
    else if (run.mode !== 'multi' && progress.stats.bestScore > 0) highlight.textContent = `Personal best: ${fmtInt(progress.stats.bestScore)}`;
    body.append(highlight);

    // Rank progress (archive)
    const rank = progress.rank();
    const promoted = rank.index > rankBefore.index;
    body.append(h('div.rank-progress',
        h('div.row', h('strong', { style: { fontFamily: 'var(--font-display)', letterSpacing: '.05em' } }, rank.name),
            promoted ? h('span.badge.new', 'Promoted') : h('span.kicker', rank.next ? `${rank.next.min - rank.count} finds to ${rank.next.name}` : 'Highest rank')),
        h('div.scalebar', { style: { '--value': rank.progress } }, h('span')),
        h('span.kicker', `${rank.count} of ${RANKS[RANKS.length - 1].min} artifacts catalogued`)));
    if (promoted) toast(`Promoted to ${rank.name}!`, { type: 'gold', icon: 'sparkle', duration: 4000 });

    const logEl = h('div.site-log');
    run.sites.forEach((s, i) => logEl.append(h('div.r',
        svgIcon(s.correct ? 'check' : 'x', s.correct ? 'ok' : 'bad'),
        h('span', `${i + 1}. ${s.country}`),
        h('span.f', `${s.recovered} find${s.recovered === 1 ? '' : 's'}${s.legendary ? ' · legendary' : ''}`),
        h('span.p', s.points > 0 ? `+${fmtInt(s.points)}` : s.points < 0 ? `${s.points}` : '0'))));
    body.append(h('div.stack', { style: { gap: '8px' } }, h('span.kicker', 'Site log'), logEl));

    let routed = false;
    const go = fn => () => { routed = true; dialogs.close('final'); fn(); };
    const foot = h('div.modal-foot.split',
        h('button.btn', { type: 'button', onclick: () => onShare(run) }, svgIcon('share'), 'Share'),
        h('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } },
            h('button.btn', { type: 'button', onclick: go(onMenu) }, 'Base camp'),
            onAgain ? h('button.btn.btn-primary', { type: 'button', onclick: go(onAgain) }, svgIcon('shovel'), run.mode === 'multi' ? 'Back to lobby' : 'New expedition') : null));
    body.append(foot);

    // Esc / backdrop close returns to base camp
    dialogs.open('final', { onClose: () => { if (!routed) onMenu?.(); } });

    if (submitScore) {
        submitScore().then(res => {
            if (res?.rank) {
                const line = h('p.highlight-line', `#${res.rank} on the global leaderboard`);
                highlight.after(line);
            }
        }).catch(() => {});
    }
}

function tile(v, k) {
    return h('div.stat-tile', h('span.v', v), h('span.k', k));
}

export { displayName };
