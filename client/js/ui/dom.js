// ============================================
// DOM helpers, dialogs, toasts — all text goes through textContent / escaping.
// ============================================

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ESC[ch]);
}

/**
 * Hyperscript-style element builder.
 * h('div.card#id', { onclick, dataset: {...}, style: {...}, attrs }, ...children)
 * Strings become text nodes (never HTML).
 */
export function h(tag, props, ...children) {
    const [, name = 'div', rest = ''] = tag.match(/^([a-z0-9-]+)?(.*)$/i);
    const el = document.createElement(name);
    for (const part of rest.match(/[.#][^.#]+/g) || []) {
        if (part[0] === '.') el.classList.add(part.slice(1));
        else el.id = part.slice(1);
    }
    if (props && (typeof props !== 'object' || props instanceof Node || Array.isArray(props))) {
        children.unshift(props);
        props = null;
    }
    for (const [key, value] of Object.entries(props || {})) {
        if (value == null || value === false) continue;
        if (key === 'class') el.className += ` ${value}`;
        else if (key === 'dataset') Object.assign(el.dataset, value);
        else if (key === 'style' && typeof value === 'object') {
            for (const [k, v] of Object.entries(value)) {
                if (k.startsWith('--')) el.style.setProperty(k, v); else el.style[k] = v;
            }
        } else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
        else if (key === 'text') el.textContent = value;
        else if (value === true) el.setAttribute(key, '');
        else el.setAttribute(key, value);
    }
    append(el, children);
    return el;
}

function append(el, children) {
    for (const child of children.flat(Infinity)) {
        if (child == null || child === false) continue;
        el.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
}

/** URL of an icon in the shared sprite (also used by the admin panel). */
export const iconHref = name => `/icons.svg#i-${name}`;

export function svgIcon(name, cls = '') {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', `icon ${cls}`.trim());
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', iconHref(name));
    svg.append(use);
    return svg;
}

export function clear(el) {
    while (el.firstChild) el.firstChild.remove();
    return el;
}

export function fmtInt(n) {
    return Math.round(Number(n) || 0).toLocaleString('en-US');
}

export function fmtTime(seconds) {
    const s = Math.max(0, Math.ceil(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function initials(name) {
    return (String(name || '?').trim()[0] || '?').toUpperCase();
}

// ---------- Dialogs ----------

const openStack = [];

export const dialogs = {
    open(id, { onClose } = {}) {
        const dlg = typeof id === 'string' ? document.getElementById(id) : id;
        if (!dlg) return null;
        if (dlg.open) return dlg;
        dlg._onClose = onClose || null;
        dlg.classList.remove('closing');
        dlg.showModal();
        openStack.push(dlg);
        document.dispatchEvent(new CustomEvent('dialogs:change'));
        return dlg;
    },

    close(id, returnValue) {
        const dlg = typeof id === 'string' ? document.getElementById(id) : id;
        if (!dlg || !dlg.open || dlg.classList.contains('closing')) return;
        dlg.classList.add('closing');
        setTimeout(() => {
            dlg.classList.remove('closing');
            if (dlg.open) dlg.close(returnValue);
        }, 150);
    },

    top() { return openStack[openStack.length - 1] || null; },
    anyOpen() { return openStack.length > 0; },
    isOpen(id) { return !!document.getElementById(id)?.open; },
};

export function initDialogs() {
    for (const dlg of $$('dialog.modal')) {
        // Animate the Esc close like any other close.
        dlg.addEventListener('cancel', e => {
            e.preventDefault();
            if (dlg.dataset.locked) return;
            dialogs.close(dlg);
        });
        dlg.addEventListener('close', () => {
            const idx = openStack.indexOf(dlg);
            if (idx >= 0) openStack.splice(idx, 1);
            const cb = dlg._onClose;
            dlg._onClose = null;
            if (cb) cb(dlg.returnValue);
            document.dispatchEvent(new CustomEvent('dialogs:change'));
        });
        // Click on the backdrop (the dialog box itself, outside its panel) closes.
        dlg.addEventListener('pointerdown', e => {
            if (e.target === dlg && !dlg.dataset.locked) dlg._backdropDown = true;
        });
        dlg.addEventListener('click', e => {
            if (e.target === dlg && dlg._backdropDown) dialogs.close(dlg);
            dlg._backdropDown = false;
            const closer = e.target.closest('[data-close]');
            if (closer && closer.closest('dialog') === dlg) dialogs.close(dlg);
        });
    }
}

// ---------- Toasts & announcements ----------

export function toast(message, { type = 'info', icon, duration = 2800 } = {}) {
    const host = document.getElementById('toasts');
    if (!host) return;
    const iconName = icon || { ok: 'check', bad: 'x', gold: 'sparkle', info: 'info' }[type] || 'info';
    const el = h(`div.toast.${type}`, { role: 'status' }, svgIcon(iconName), h('span', message));
    host.append(el);
    while (host.children.length > 3) host.firstChild.remove();
    setTimeout(() => {
        el.classList.add('out');
        setTimeout(() => el.remove(), 280);
    }, duration);
}

export function announce(message) {
    const el = document.getElementById('announcer');
    if (!el) return;
    el.textContent = '';
    requestAnimationFrame(() => { el.textContent = message; });
}

// ---------- Segmented controls & swatches ----------

/** Build a single-choice segmented control inside `host`. */
export function segmented(host, options, value, onChange) {
    clear(host);
    const buttons = options.map(opt => {
        const btn = h('button', {
            type: 'button', role: 'radio', 'aria-checked': String(opt.value === value),
            dataset: { value: String(opt.value) },
        }, opt.label, opt.sub ? h('small', opt.sub) : null);
        btn.addEventListener('click', () => select(opt.value, true));
        return btn;
    });
    host.append(...buttons);
    host.addEventListener('keydown', e => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
        e.preventDefault();
        const i = options.findIndex(o => o.value === current);
        const step = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1;
        const next = options[(i + step + options.length) % options.length];
        select(next.value, true);
        buttons[options.indexOf(next)].focus();
    });
    let current = value;
    function select(v, fromUser) {
        current = v;
        buttons.forEach((b, i) => {
            const on = options[i].value === v;
            b.setAttribute('aria-checked', String(on));
            b.tabIndex = on ? 0 : -1;
        });
        if (fromUser && onChange) onChange(v);
    }
    select(value, false);
    return { get value() { return current; }, set: v => select(v, false) };
}

export function swatches(host, colors, value, onChange) {
    clear(host);
    const els = colors.map(c => {
        const el = h('button.swatch', {
            type: 'button', role: 'radio', 'aria-label': c.name, title: c.name,
            'aria-checked': String(c.value === value), style: { '--c': c.value },
        });
        el.addEventListener('click', () => {
            els.forEach(e => e.setAttribute('aria-checked', 'false'));
            el.setAttribute('aria-checked', 'true');
            onChange(c.value);
        });
        return el;
    });
    host.append(...els);
    return {
        set(v) { els.forEach((e, i) => e.setAttribute('aria-checked', String(colors[i].value === v))); },
    };
}

export async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        const ta = h('textarea', { style: { position: 'fixed', opacity: '0' } });
        ta.value = text;
        document.body.append(ta);
        ta.select();
        let ok = false;
        try { ok = document.execCommand('copy'); } catch { /* unsupported */ }
        ta.remove();
        return ok;
    }
}

export const isTouch = () => window.matchMedia('(pointer: coarse)').matches;
