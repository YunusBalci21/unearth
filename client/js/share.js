// ============================================
// SHARE — spoiler-free result text for social posts.
// ============================================

import { $, h, clear, svgIcon, dialogs, copyText, toast } from './ui/dom.js';

const SITE_URL = 'https://www.playunearth.tech';

export function shareText(run) {
    // Plain text only, no emoji: ✓ / ✗ per site keeps it spoiler-free.
    const marks = run.sites.map(s => (s.correct ? '✓' : '✗')).join(' ');
    const legendary = run.sites.reduce((n, s) => n + (s.legendary || 0), 0);
    const lines = [
        run.daily ? `UNEARTH · Daily Dig #${run.daily}` : `UNEARTH · ${run.regionLabel || 'Worldwide'} expedition`,
        `${marks}   ${run.correct}/${run.sites.length} sites identified`,
        `${run.score.toLocaleString('en-US')} pts · ${run.finds} ${run.finds === 1 ? 'find' : 'finds'}${legendary ? ` · ${legendary} legendary` : ''}`,
    ];
    if (run.bestStreak >= 3) lines.push(`Best streak: ${run.bestStreak} sites`);
    lines.push('', SITE_URL);
    return lines.join('\n');
}

export function openShare(run) {
    const text = shareText(run);
    $('#share-text').textContent = text;
    const actions = clear($('#share-actions'));
    const encoded = encodeURIComponent(text);
    const open = url => window.open(url, '_blank', 'noopener,width=600,height=520');

    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
        actions.append(h('button.btn', { type: 'button', onclick: async () => {
            try { await navigator.share({ title: 'Unearth', text }); } catch { /* cancelled */ }
        } }, svgIcon('share'), 'Share…'));
    }
    actions.append(
        h('button.btn', { type: 'button', onclick: () => open(`https://twitter.com/intent/tweet?text=${encoded}`) }, 'Post on X'),
        h('button.btn', { type: 'button', onclick: () => open(`https://www.reddit.com/submit?title=${encodeURIComponent('My Unearth expedition')}&text=${encoded}`) }, 'Reddit'),
        h('button.btn', { type: 'button', onclick: () => open(`https://wa.me/?text=${encoded}`) }, 'WhatsApp'),
        h('button.btn.btn-primary', { type: 'button', onclick: async () => {
            const ok = await copyText(text);
            toast(ok ? 'Copied to clipboard' : 'Copy failed — select the text instead', { type: ok ? 'ok' : 'bad' });
        } }, svgIcon('copy'), 'Copy'),
    );
    dialogs.open('share');
}
