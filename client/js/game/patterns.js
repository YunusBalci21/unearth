// ============================================
// PATTERNS — procedural canvas textures for decorated artifacts.
// Textures are cached per (pattern, colour) and shared between renderers.
// ============================================

import * as THREE from 'three';

const cache = new Map();

const hex = c => `#${new THREE.Color(c).getHexString()}`;
const shade = (c, k) => { const col = new THREE.Color(c); col.multiplyScalar(k); return `#${col.getHexString()}`; };

function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => ((s = Math.imul(s ^ (s >>> 15), 2246822519) ^ Math.imul(s ^ (s >>> 13), 3266489917)) >>> 0) / 4294967296;
}

function canvas(w = 512, h = 256) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return [c, c.getContext('2d')];
}

function band(ctx, y, hgt, color, w) { ctx.fillStyle = color; ctx.fillRect(0, y, w, hgt); }

function meander(ctx, y, size, color, w) {
    ctx.strokeStyle = color; ctx.lineWidth = size * 0.18; ctx.lineCap = 'square';
    for (let x = 0; x < w; x += size) {
        ctx.beginPath();
        ctx.moveTo(x, y + size);
        ctx.lineTo(x, y); ctx.lineTo(x + size * 0.8, y); ctx.lineTo(x + size * 0.8, y + size * 0.65);
        ctx.lineTo(x + size * 0.35, y + size * 0.65); ctx.lineTo(x + size * 0.35, y + size * 0.35);
        ctx.stroke();
    }
}

function figures(ctx, y, hgt, color, w, r, count = 6) {
    ctx.fillStyle = color;
    for (let i = 0; i < count; i++) {
        const x = (i + 0.5) * (w / count) + (r() - 0.5) * 20;
        const s = hgt * (0.75 + r() * 0.2);
        ctx.beginPath(); ctx.arc(x, y + hgt - s + s * 0.1, s * 0.09, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x - s * 0.12, y + hgt); ctx.lineTo(x - s * 0.05, y + hgt - s * 0.75);
        ctx.lineTo(x + s * 0.06, y + hgt - s * 0.75); ctx.lineTo(x + s * 0.14, y + hgt);
        ctx.fill();
        ctx.fillRect(x - s * 0.22, y + hgt - s * 0.62, s * 0.44, s * 0.05);
        if (r() > 0.5) { ctx.beginPath(); ctx.arc(x + s * 0.25, y + hgt - s * 0.5, s * 0.14, 0, Math.PI * 2); ctx.fill(); }
    }
}

function glyphRows(ctx, w, h, color, style, r) {
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineCap = 'round';
    const rows = style === 'cuneiform' ? 9 : 6;
    const rowH = h / (rows + 1);
    for (let row = 0; row < rows; row++) {
        const y = rowH * (row + 0.7);
        if (style !== 'hieroglyphs') { ctx.globalAlpha = 0.35; ctx.fillRect(w * 0.06, y + rowH * 0.62, w * 0.88, 1.5); ctx.globalAlpha = 1; }
        let x = w * 0.08;
        while (x < w * 0.9) {
            const s = rowH * 0.5;
            ctx.lineWidth = Math.max(1.5, s * 0.14);
            if (style === 'cuneiform') {
                for (let k = 0; k < 1 + Math.floor(r() * 3); k++) {
                    const ox = x + k * s * 0.35, oy = y + r() * s * 0.4;
                    ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + s * 0.28, oy + s * 0.1); ctx.lineTo(ox, oy + s * 0.2); ctx.fill();
                    ctx.beginPath(); ctx.moveTo(ox + s * 0.05, oy + s * 0.1); ctx.lineTo(ox + s * 0.05, oy + s * 0.7); ctx.stroke();
                }
                x += s * (0.8 + r() * 0.6);
            } else if (style === 'runes') {
                ctx.beginPath();
                ctx.moveTo(x, y); ctx.lineTo(x, y + s * 1.1);
                const t = r();
                if (t < 0.33) { ctx.moveTo(x, y + s * 0.2); ctx.lineTo(x + s * 0.4, y + s * 0.5); }
                else if (t < 0.66) { ctx.moveTo(x, y); ctx.lineTo(x + s * 0.4, y + s * 0.4); ctx.lineTo(x, y + s * 0.8); }
                else { ctx.moveTo(x - s * 0.3, y + s * 0.3); ctx.lineTo(x + s * 0.3, y + s * 0.7); }
                ctx.stroke();
                x += s * 0.8;
            } else if (style === 'hieroglyphs' || style === 'mayaglyphs' || style === 'indus' || style === 'oracle' || style === 'geez') {
                const t = r();
                ctx.beginPath();
                if (style === 'mayaglyphs') {
                    ctx.lineWidth = 2; ctx.strokeRect(x, y - s * 0.2, s * 1.2, s * 1.2);
                    ctx.beginPath(); ctx.arc(x + s * 0.6, y + s * 0.4, s * 0.3, 0, Math.PI * 2); ctx.stroke();
                    x += s * 1.6; continue;
                }
                if (t < 0.2) { ctx.arc(x + s * 0.3, y + s * 0.4, s * 0.3, 0, Math.PI * 2); ctx.stroke(); }
                else if (t < 0.4) { ctx.moveTo(x, y + s); ctx.quadraticCurveTo(x + s * 0.3, y - s * 0.2, x + s * 0.7, y + s); ctx.stroke(); }
                else if (t < 0.55) { ctx.ellipse(x + s * 0.35, y + s * 0.55, s * 0.35, s * 0.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(x + s * 0.3, y - s * 0.1, s * 0.1, s * 0.5); }
                else if (t < 0.7) { ctx.moveTo(x, y); ctx.lineTo(x + s * 0.6, y + s); ctx.moveTo(x + s * 0.6, y); ctx.lineTo(x, y + s); ctx.stroke(); }
                else if (t < 0.85) { ctx.moveTo(x, y + s * 0.2); ctx.lineTo(x + s * 0.7, y + s * 0.2); ctx.moveTo(x + s * 0.35, y + s * 0.2); ctx.lineTo(x + s * 0.35, y + s); ctx.stroke(); }
                else { ctx.moveTo(x, y + s); ctx.lineTo(x + s * 0.35, y); ctx.lineTo(x + s * 0.7, y + s); ctx.closePath(); ctx.stroke(); }
                x += s * (1.0 + r() * 0.3);
            } else {
                ctx.fillRect(x, y, s * 0.15, s);
                x += s * 0.5;
            }
        }
    }
}

function stars(ctx, w, h, colors, cell = 64) {
    for (let y = 0; y < h + cell; y += cell) {
        for (let x = 0; x < w + cell; x += cell) {
            const cx = x + ((y / cell) % 2 ? cell / 2 : 0), cy = y;
            ctx.fillStyle = colors[((x + y) / cell) % colors.length | 0];
            ctx.beginPath();
            for (let i = 0; i < 16; i++) {
                const a = (i / 16) * Math.PI * 2;
                const rr = i % 2 ? cell * 0.22 : cell * 0.42;
                ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
            }
            ctx.fill();
            ctx.fillStyle = colors[(((x + y) / cell) + 1) % colors.length | 0];
            ctx.beginPath(); ctx.arc(cx, cy, cell * 0.12, 0, Math.PI * 2); ctx.fill();
        }
    }
}

function tiles(ctx, w, h, colors, size, r, grout = '#2a2420') {
    ctx.fillStyle = grout; ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += size) {
        for (let x = 0; x < w; x += size) {
            ctx.fillStyle = colors[Math.floor(r() * colors.length)];
            ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
        }
    }
}

function scrolls(ctx, w, h, color, r, count = 14, size = 26) {
    ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (let i = 0; i < count; i++) {
        const x = r() * w, y = r() * h, s = size * (0.6 + r() * 0.8);
        ctx.beginPath();
        for (let t = 0; t < 10; t += 0.25) ctx.lineTo(x + Math.cos(t) * s * (t / 10), y + Math.sin(t) * s * (t / 10));
        ctx.stroke();
        ctx.beginPath(); ctx.arc(x + s * 0.9, y - s * 0.4, s * 0.25, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
    }
}

function dotField(ctx, w, h, colors, r) {
    for (let i = 0; i < 9; i++) {
        const cx = r() * w, cy = r() * h, rings = 3 + Math.floor(r() * 3);
        for (let k = rings; k > 0; k--) {
            const rad = k * 9;
            const n = Math.max(6, Math.floor(rad * 0.9));
            ctx.fillStyle = colors[k % colors.length];
            for (let j = 0; j < n; j++) {
                const a = (j / n) * Math.PI * 2;
                ctx.beginPath(); ctx.arc(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad, 2.6, 0, Math.PI * 2); ctx.fill();
            }
        }
    }
    for (let i = 0; i < 900; i++) {
        ctx.fillStyle = colors[i % colors.length];
        ctx.globalAlpha = 0.6;
        ctx.beginPath(); ctx.arc(r() * w, r() * h, 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
}

function rockFigures(ctx, w, h, color, r, kind) {
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
        const x = 40 + r() * (w - 80), y = 40 + r() * (h - 80), s = 26 + r() * 20;
        ctx.beginPath();
        if (kind === 'wandjina') {
            ctx.arc(x, y, s * 0.6, Math.PI, 0); ctx.stroke();
            ctx.beginPath(); ctx.ellipse(x, y + s * 0.1, s * 0.45, s * 0.6, 0, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.arc(x - s * 0.15, y, 4, 0, 7); ctx.arc(x + s * 0.15, y, 4, 0, 7); ctx.fill();
        } else if (i % 3 === 0) { // boat
            ctx.moveTo(x - s, y); ctx.quadraticCurveTo(x, y + s * 0.6, x + s, y); ctx.stroke();
            for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(x + k * s * 0.3, y + s * 0.15); ctx.lineTo(x + k * s * 0.3, y - s * 0.3); ctx.stroke(); }
        } else if (i % 3 === 1) { // animal
            ctx.moveTo(x - s * 0.6, y); ctx.lineTo(x + s * 0.5, y); ctx.lineTo(x + s * 0.8, y - s * 0.4);
            ctx.moveTo(x - s * 0.5, y); ctx.lineTo(x - s * 0.6, y + s * 0.5); ctx.moveTo(x + s * 0.4, y); ctx.lineTo(x + s * 0.45, y + s * 0.5);
            ctx.stroke();
        } else { // human
            ctx.arc(x, y - s * 0.6, s * 0.15, 0, 7); ctx.fill();
            ctx.beginPath(); ctx.moveTo(x, y - s * 0.45); ctx.lineTo(x, y + s * 0.2);
            ctx.moveTo(x - s * 0.4, y - s * 0.4); ctx.lineTo(x, y - s * 0.2); ctx.lineTo(x + s * 0.4, y - s * 0.45);
            ctx.moveTo(x, y + s * 0.2); ctx.lineTo(x - s * 0.25, y + s * 0.6); ctx.moveTo(x, y + s * 0.2); ctx.lineTo(x + s * 0.25, y + s * 0.6);
            ctx.stroke();
        }
    }
}

function grain(ctx, w, h, r, alpha = 0.08) {
    for (let i = 0; i < 1600; i++) {
        ctx.fillStyle = r() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
        ctx.fillRect(r() * w, r() * h, 2, 2);
    }
}

const DRAW = {
    stripes(ctx, w, h, base, accent) {
        ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
        for (let y = 0; y < h; y += 28) band(ctx, y, 14, accent, w);
    },
    meander(ctx, w, h, base, accent, r) {
        ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
        band(ctx, h * 0.3, h * 0.42, '#1b1410', w);
        figures(ctx, h * 0.32, h * 0.38, '#d36f3c', w, r, 5);
        meander(ctx, h * 0.12, 22, '#1b1410', w);
        meander(ctx, h * 0.78, 22, '#1b1410', w);
        band(ctx, 0, 6, '#1b1410', w); band(ctx, h - 8, 8, '#1b1410', w);
    },
    bluewhite(ctx, w, h, base, accent, r) {
        ctx.fillStyle = '#f3f1ea'; ctx.fillRect(0, 0, w, h);
        const blue = '#22408f';
        band(ctx, h * 0.06, 6, blue, w); band(ctx, h * 0.9, 6, blue, w);
        scrolls(ctx, w, h * 0.7, blue, r, 16, 30);
        ctx.save(); ctx.translate(0, h * 0.15); scrolls(ctx, w, h * 0.7, '#3a5fb8', r, 10, 18); ctx.restore();
    },
    cranes(ctx, w, h, base, accent, r) {
        ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 6; i++) {
            const x = (i + 0.5) * w / 6, y = h * (0.35 + (i % 2) * 0.3);
            ctx.strokeStyle = '#f6f3ea'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(x, y, 30, 0, Math.PI * 2); ctx.stroke();
            ctx.strokeStyle = '#2b2a28'; ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.moveTo(x - 16, y + 4); ctx.lineTo(x, y - 6); ctx.lineTo(x + 16, y + 4); ctx.moveTo(x, y - 6); ctx.lineTo(x + 6, y + 14); ctx.stroke();
        }
        grain(ctx, w, h, r, 0.04);
    },
    sancai(ctx, w, h, base, accent, r) {
        ctx.fillStyle = '#b98a3e'; ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 40; i++) {
            ctx.fillStyle = ['#2f7a45', '#efe2c0', '#8a5a1c'][i % 3];
            const x = r() * w, y = r() * h * 0.6;
            ctx.beginPath(); ctx.ellipse(x, y, 10 + r() * 14, 30 + r() * 60, 0, 0, Math.PI * 2); ctx.fill();
        }
    },
    glyphs(ctx, w, h, base, accent, r, style) {
        ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
        grain(ctx, w, h, r, 0.06);
        glyphRows(ctx, w, h, shade(base, 0.45), style, r);
    },
    stainedglass(ctx, w, h, base, accent, r) {
        const cols = ['#1d3f9a', '#b2282b', '#2f7d3b', '#e0b33a', '#5a2a7a', '#1d3f9a'];
        ctx.fillStyle = '#1a1612'; ctx.fillRect(0, 0, w, h);
        const pts = Array.from({ length: 40 }, () => [r() * w, r() * h]);
        const img = ctx.getImageData(0, 0, w, h);
        for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
            let best = 0, bd = 1e9, second = 1e9;
            pts.forEach(([px, py], i) => { const d = (px - x) ** 2 + (py - y) ** 2; if (d < bd) { second = bd; bd = d; best = i; } else if (d < second) second = d; });
            const edge = Math.sqrt(second) - Math.sqrt(bd) < 3;
            const c = new THREE.Color(edge ? '#141210' : cols[best % cols.length]);
            for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
                const o = ((y + dy) * w + (x + dx)) * 4;
                img.data[o] = c.r * 255; img.data[o + 1] = c.g * 255; img.data[o + 2] = c.b * 255; img.data[o + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
    },
    mosaic(ctx, w, h, base, accent, r) {
        tiles(ctx, w, h, ['#e6dcc6', '#d8cdb3', '#e9e0cc'], 12, r, '#b8ad96');
        ctx.save();
        const cols = ['#2f2a26', '#a2442d', '#c9a24e', '#3e6f8a'];
        for (let ring = 0; ring < 4; ring++) {
            const rad = 100 - ring * 22;
            for (let a = 0; a < Math.PI * 2; a += 0.1) {
                ctx.fillStyle = cols[ring];
                ctx.fillRect(w / 2 + Math.cos(a) * rad - 5, h / 2 + Math.sin(a) * rad * 0.9 - 5, 10, 10);
            }
        }
        ctx.restore();
    },
    zellige(ctx, w, h) {
        ctx.fillStyle = '#efe7d6'; ctx.fillRect(0, 0, w, h);
        stars(ctx, w, h, ['#1f5e8c', '#2d7a4f', '#efe7d6', '#c4512c', '#1c1c1c'], 64);
    },
    iznik(ctx, w, h, base, accent, r) {
        ctx.fillStyle = '#f2efe6'; ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 10; i++) {
            const x = r() * w, y = r() * h;
            ctx.strokeStyle = '#1e5c3a'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(x, y + 60); ctx.quadraticCurveTo(x + 20, y + 20, x, y); ctx.stroke();
            ctx.fillStyle = i % 2 ? '#c8312b' : '#23519e';
            ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - 18, y - 30, x, y - 44); ctx.quadraticCurveTo(x + 18, y - 30, x, y); ctx.fill();
            ctx.fillStyle = '#3a8fb0'; ctx.beginPath(); ctx.ellipse(x + 22, y + 30, 6, 14, 0.6, 0, 7); ctx.fill();
        }
        ctx.strokeStyle = '#23519e'; ctx.lineWidth = 8; ctx.strokeRect(4, 4, w - 8, h - 8);
    },
    delft(ctx, w, h, base, accent, r) {
        ctx.fillStyle = '#f1f3f5'; ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#27458f'; ctx.fillStyle = '#27458f'; ctx.lineWidth = 3;
        ctx.strokeRect(10, 10, w - 20, h - 20);
        const cx = w / 2, cy = h * 0.6;
        ctx.beginPath(); ctx.moveTo(cx - 20, cy + 50); ctx.lineTo(cx - 10, cy - 30); ctx.lineTo(cx + 10, cy - 30); ctx.lineTo(cx + 20, cy + 50); ctx.stroke();
        for (let k = 0; k < 4; k++) {
            ctx.save(); ctx.translate(cx, cy - 34); ctx.rotate(k * Math.PI / 2 + 0.3);
            ctx.fillRect(0, -6, 60, 12); ctx.restore();
        }
        ctx.beginPath(); ctx.moveTo(20, cy + 60); ctx.quadraticCurveTo(w / 2, cy + 40, w - 20, cy + 60); ctx.stroke();
        for (const [x, y] of [[20, 20], [w - 20, 20], [20, h - 20], [w - 20, h - 20]]) { ctx.beginPath(); ctx.arc(x, y, 10, 0, 7); ctx.fill(); }
        grain(ctx, w, h, r, 0.03);
    },
    carpet(ctx, w, h, base, accent, r) {
        ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#1d2a4f'; ctx.fillRect(0, 0, w, 30); ctx.fillRect(0, h - 30, w, 30);
        ctx.fillStyle = '#d9b45b';
        for (let x = 10; x < w; x += 24) { ctx.beginPath(); ctx.arc(x, 15, 5, 0, 7); ctx.arc(x, h - 15, 5, 0, 7); ctx.fill(); }
        ctx.fillStyle = '#1d2a4f';
        ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w * 0.22, h * 0.28, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#d9b45b';
        ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w * 0.12, h * 0.16, 0, 0, 7); ctx.fill();
        scrolls(ctx, w, h, '#e9d7a8', r, 12, 14);
    },
    batik(ctx, w, h, base, accent, r) {
        ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#efdcb1'; ctx.lineWidth = 3;
        for (let y = 0; y < h + 40; y += 40) for (let x = 0; x < w + 40; x += 40) {
            ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.arc(x + 20, y + 20, 5, 0, 7); ctx.fillStyle = '#1f2a44'; ctx.fill();
        }
    },
    adire(ctx, w, h, base) {
        ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#cfd8ee'; ctx.fillStyle = '#cfd8ee'; ctx.lineWidth = 3;
        for (let y = 0; y < h; y += 64) for (let x = 0; x < w; x += 64) {
            if (((x + y) / 64) % 2) { for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.arc(x + 32, y + 32, k * 8, 0, 7); ctx.stroke(); } }
            else { for (let k = 0; k < 6; k++) ctx.fillRect(x + 8, y + 8 + k * 9, 48, 3); }
        }
    },
    navajo(ctx, w, h, base) {
        ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 4; i++) {
            const cx = (i + 0.5) * w / 4, cy = h / 2;
            for (let k = 5; k > 0; k--) {
                ctx.fillStyle = ['#1c1a18', '#f1ebdd', '#1c1a18', '#c9a24e', '#f1ebdd'][k - 1];
                ctx.beginPath(); ctx.moveTo(cx, cy - k * 18); ctx.lineTo(cx + k * 12, cy); ctx.lineTo(cx, cy + k * 18); ctx.lineTo(cx - k * 12, cy); ctx.fill();
            }
        }
        band(ctx, 8, 10, '#1c1a18', w); band(ctx, h - 18, 10, '#1c1a18', w);
    },
    dots(ctx, w, h, base, accent, r) {
        ctx.fillStyle = '#2a1a12'; ctx.fillRect(0, 0, w, h);
        dotField(ctx, w, h, ['#e8d7b0', '#c0582d', '#e3a23c', '#f4f1e6'], r);
    },
    knotwork(ctx, w, h, base, accent, r) {
        ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
        ctx.lineWidth = 5;
        const cols = ['#9c2a22', '#2a4f8f', '#c99a2e', '#2f6b3c'];
        for (let i = 0; i < 26; i++) {
            ctx.strokeStyle = cols[i % 4];
            const x = (i % 13) * (w / 12), y = i < 13 ? h * 0.28 : h * 0.72;
            ctx.beginPath(); ctx.arc(x, y, 26, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.strokeStyle = '#c99a2e'; ctx.lineWidth = 6; ctx.strokeRect(6, 6, w - 12, h - 12);
        grain(ctx, w, h, r, 0.05);
    },
    spiral(ctx, w, h, base, accent, r) {
        ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
        grain(ctx, w, h, r, 0.08);
        ctx.strokeStyle = shade(base, 0.5); ctx.lineWidth = 6;
        for (let i = 0; i < 5; i++) {
            const cx = (i + 0.5) * w / 5, cy = h / 2 + (i % 2 ? -30 : 30);
            ctx.beginPath();
            for (let t = 0; t < 18; t += 0.2) ctx.lineTo(cx + Math.cos(t) * t * 3.2, cy + Math.sin(t) * t * 3.2);
            ctx.stroke();
        }
    },
    fresco(ctx, w, h, base, accent, r) {
        ctx.fillStyle = '#8f1f1a'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#1c1714'; ctx.fillRect(w * 0.08, h * 0.15, w * 0.36, h * 0.7); ctx.fillRect(w * 0.56, h * 0.15, w * 0.36, h * 0.7);
        ctx.strokeStyle = '#d9b45b'; ctx.lineWidth = 2;
        ctx.strokeRect(w * 0.1, h * 0.18, w * 0.32, h * 0.64); ctx.strokeRect(w * 0.58, h * 0.18, w * 0.32, h * 0.64);
        figures(ctx, h * 0.3, h * 0.45, '#e2c9a0', w, r, 2);
        grain(ctx, w, h, r, 0.08);
    },
    relief(ctx, w, h, base, accent, r) {
        ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
        grain(ctx, w, h, r, 0.08);
        ctx.save(); ctx.translate(3, 3); figures(ctx, h * 0.2, h * 0.6, shade(base, 0.55), w, r, 5); ctx.restore();
        figures(ctx, h * 0.2, h * 0.6, shade(base, 1.18), w, r, 5);
    },
    petroglyph(ctx, w, h, base, accent, r) {
        ctx.fillStyle = base; ctx.fillRect(0, 0, w, h); grain(ctx, w, h, r, 0.1);
        rockFigures(ctx, w, h, '#a8361e', r);
    },
    rockart(ctx, w, h, base, accent, r) {
        ctx.fillStyle = '#b77b4f'; ctx.fillRect(0, 0, w, h); grain(ctx, w, h, r, 0.12);
        rockFigures(ctx, w, h, '#7a1f12', r);
    },
    wandjina(ctx, w, h, base, accent, r) {
        ctx.fillStyle = '#c69a6c'; ctx.fillRect(0, 0, w, h); grain(ctx, w, h, r, 0.1);
        rockFigures(ctx, w, h, '#f2ece0', r, 'wandjina');
    },
    map(ctx, w, h, base, accent, r) {
        ctx.fillStyle = '#e8d8ae'; ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(80,60,30,0.35)'; ctx.lineWidth = 1;
        for (let x = 0; x < w; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
        for (let y = 0; y < h; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
        for (let i = 0; i < 5; i++) {
            ctx.fillStyle = ['#c9b07a', '#b7c48f', '#d4a77a'][i % 3];
            ctx.strokeStyle = '#5a3f22'; ctx.lineWidth = 2;
            const cx = r() * w, cy = r() * h; ctx.beginPath();
            for (let a = 0; a < Math.PI * 2; a += 0.3) { const rr = 30 + r() * 30; ctx.lineTo(cx + Math.cos(a) * rr * 1.4, cy + Math.sin(a) * rr); }
            ctx.closePath(); ctx.fill(); ctx.stroke();
        }
        ctx.strokeStyle = '#5a3f22'; ctx.lineWidth = 6; ctx.strokeRect(5, 5, w - 10, h - 10);
    },
    icon(ctx, w, h) {
        ctx.fillStyle = '#c99a3a'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#6b1d18'; ctx.fillRect(10, 10, w - 20, h - 20);
        ctx.fillStyle = '#d9ad4c'; ctx.fillRect(22, 22, w - 44, h - 44);
        for (const x of [w * 0.3, w * 0.5, w * 0.7]) {
            ctx.fillStyle = '#e7c76a'; ctx.beginPath(); ctx.arc(x, h * 0.4, 22, 0, 7); ctx.fill();
            ctx.fillStyle = '#d9b48a'; ctx.beginPath(); ctx.arc(x, h * 0.42, 13, 0, 7); ctx.fill();
            ctx.fillStyle = ['#2a4a8a', '#7a1f1a', '#2f6b3c'][Math.round(x / w * 3) % 3];
            ctx.beginPath(); ctx.moveTo(x - 26, h * 0.85); ctx.lineTo(x - 14, h * 0.52); ctx.lineTo(x + 14, h * 0.52); ctx.lineTo(x + 26, h * 0.85); ctx.fill();
        }
    },
    miniature(ctx, w, h, base, accent, r) {
        ctx.fillStyle = '#ecdcb4'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#2a4f8f'; ctx.fillRect(30, 20, w - 60, h - 40);
        ctx.fillStyle = '#5c8a4a'; ctx.fillRect(30, h * 0.55, w - 60, h * 0.45 - 20);
        figures(ctx, h * 0.35, h * 0.4, '#c8312b', w, r, 4);
        ctx.strokeStyle = '#c9a24e'; ctx.lineWidth = 6; ctx.strokeRect(24, 14, w - 48, h - 28);
        glyphRows(ctx, w, h * 0.18, '#3a2a1a', 'geez', r);
    },
    wayang(ctx, w, h, base) {
        ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#d9a93b';
        for (let y = 10; y < h; y += 18) for (let x = 10; x < w; x += 18) { ctx.beginPath(); ctx.arc(x + ((y / 18) % 2) * 9, y, 3.5, 0, 7); ctx.fill(); }
        ctx.strokeStyle = '#8f1f1a'; ctx.lineWidth = 8; ctx.strokeRect(20, 20, w - 40, h - 40);
    },
    picturestone(ctx, w, h, base, accent, r) {
        ctx.fillStyle = base; ctx.fillRect(0, 0, w, h); grain(ctx, w, h, r, 0.08);
        ctx.strokeStyle = shade(base, 0.5); ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(w * 0.2, h * 0.7); ctx.quadraticCurveTo(w * 0.5, h * 0.9, w * 0.8, h * 0.7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(w * 0.5, h * 0.75); ctx.lineTo(w * 0.5, h * 0.35); ctx.lineTo(w * 0.7, h * 0.6); ctx.stroke();
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(0, h * (0.15 + i * 0.08)); ctx.quadraticCurveTo(w / 2, h * (0.1 + i * 0.08), w, h * (0.15 + i * 0.08)); ctx.stroke(); }
    },
    incised(ctx, w, h, base, accent, r) {
        ctx.fillStyle = base; ctx.fillRect(0, 0, w, h); grain(ctx, w, h, r, 0.06);
        ctx.strokeStyle = shade(base, 0.55); ctx.lineWidth = 3;
        for (let row = 0; row < 3; row++) {
            ctx.beginPath();
            for (let x = 0; x <= w; x += 16) ctx.lineTo(x, h * (0.2 + row * 0.12) + (x / 16 % 2) * 14);
            ctx.stroke();
        }
        for (let x = 0; x < w; x += 10) { ctx.beginPath(); ctx.moveTo(x, h * 0.65); ctx.lineTo(x + 4, h * 0.8); ctx.stroke(); }
    },
    glyphband(ctx, w, h, base, accent, r) {
        ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
        band(ctx, h * 0.08, h * 0.16, '#efe2c0', w);
        ctx.save(); ctx.translate(0, h * 0.07); glyphRows(ctx, w, h * 0.22, '#4a2a1a', 'mayaglyphs', r); ctx.restore();
        figures(ctx, h * 0.38, h * 0.5, '#2b1a12', w, r, 3);
    },
    nazca(ctx, w, h, base, accent, r) {
        ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
        const cols = ['#9c2d1f', '#2a2420', '#e6dcc4', '#c47a2c', '#6b7a8f'];
        for (let i = 0; i < 6; i++) band(ctx, i * h / 6, h / 12, cols[i % cols.length], w);
        ctx.fillStyle = '#2a2420';
        for (let i = 0; i < 6; i++) { const x = (i + 0.5) * w / 6; ctx.beginPath(); ctx.moveTo(x - 20, h * 0.6); ctx.lineTo(x + 24, h * 0.5); ctx.lineTo(x - 8, h * 0.46); ctx.closePath(); ctx.fill(); }
    },
    andean(ctx, w, h, base) {
        ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
        const cols = ['#e3b23c', '#1f1a17', '#2a5a8a', '#f0e6d0'];
        for (let y = 0; y < h; y += 64) for (let x = 0; x < w; x += 64) {
            ctx.fillStyle = cols[((x + y) / 64) % 4];
            for (let s = 0; s < 4; s++) ctx.fillRect(x + 8 + s * 10, y + 48 - s * 12, 48 - s * 20 > 0 ? 48 - s * 20 : 8, 12);
            ctx.fillStyle = '#1f1a17'; ctx.fillRect(x + 40, y + 10, 10, 10);
        }
    },
    marajoara(ctx, w, h, base, accent, r) {
        ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#8f2a1c'; ctx.lineWidth = 7;
        for (let i = 0; i < 6; i++) {
            const cx = (i + 0.5) * w / 6, cy = h / 2;
            ctx.beginPath(); ctx.moveTo(cx - 30, cy - 50); ctx.lineTo(cx + 30, cy - 50); ctx.lineTo(cx + 30, cy + 10); ctx.lineTo(cx - 10, cy + 10); ctx.lineTo(cx - 10, cy - 20); ctx.lineTo(cx + 10, cy - 20); ctx.stroke();
        }
        ctx.strokeStyle = '#211a16'; ctx.lineWidth = 4;
        meander(ctx, h * 0.82, 20, '#211a16', w);
    },
    pueblo(ctx, w, h, base) {
        ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#1b1917'; ctx.strokeStyle = '#1b1917'; ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
            const x = i * w / 8;
            ctx.beginPath(); ctx.moveTo(x, h * 0.3); ctx.lineTo(x + w / 16, h * 0.15); ctx.lineTo(x + w / 8, h * 0.3); ctx.fill();
            for (let k = 0; k < 8; k++) { ctx.beginPath(); ctx.moveTo(x + k * 7, h * 0.4); ctx.lineTo(x + k * 7 + 20, h * 0.75); ctx.stroke(); }
        }
        band(ctx, h * 0.08, 5, '#1b1917', w); band(ctx, h * 0.82, 5, '#1b1917', w);
    },
    jasper(ctx, w, h, base, accent, r) {
        ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
        figures(ctx, h * 0.25, h * 0.5, '#f4f2ec', w, r, 4);
        band(ctx, h * 0.12, 6, '#f4f2ec', w); band(ctx, h * 0.84, 6, '#f4f2ec', w);
    },
    sevres(ctx, w, h) {
        ctx.fillStyle = '#1d3f9a'; ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 2; i++) {
            const x = w * (0.1 + i * 0.5);
            ctx.fillStyle = '#f6f3ea'; ctx.beginPath(); ctx.ellipse(x + w * 0.2, h / 2, w * 0.13, h * 0.3, 0, 0, 7); ctx.fill();
            ctx.strokeStyle = '#d9b14a'; ctx.lineWidth = 6; ctx.stroke();
            ctx.fillStyle = '#c8546a'; ctx.beginPath(); ctx.arc(x + w * 0.2, h / 2, 14, 0, 7); ctx.fill();
        }
        band(ctx, 6, 8, '#d9b14a', w); band(ctx, h - 14, 8, '#d9b14a', w);
    },
    swirl(ctx, w, h, base) {
        ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#a3381f'; ctx.lineWidth = 9; ctx.lineCap = 'round';
        for (let i = 0; i < 5; i++) {
            const cx = (i + 0.5) * w / 5, cy = h / 2;
            ctx.beginPath();
            for (let t = 0; t < 14; t += 0.2) ctx.lineTo(cx + Math.cos(t) * t * 3.6, cy + Math.sin(t) * t * 3.6 * (i % 2 ? 1 : -1));
            ctx.stroke();
        }
    },
    eagle(ctx, w, h, base) {
        ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#1a1714';
        const cx = w / 2, cy = h / 2;
        ctx.beginPath(); ctx.ellipse(cx, cy, 30, 60, 0, 0, 7); ctx.fill();
        for (const s of [-1, 1]) {
            ctx.beginPath(); ctx.moveTo(cx, cy - 20);
            for (let k = 0; k < 5; k++) ctx.lineTo(cx + s * (40 + k * 18), cy - 50 + k * 22);
            ctx.lineTo(cx, cy + 20); ctx.fill();
            ctx.beginPath(); ctx.arc(cx + s * 22, cy - 70, 14, 0, 7); ctx.fill();
        }
    },
    ochre(ctx, w, h, base, accent, r) {
        ctx.fillStyle = '#3b2418'; ctx.fillRect(0, 0, w, h);
        const cols = ['#c0582d', '#efe7d6', '#e3a23c', '#1a120c'];
        for (let i = 0; i < 10; i++) band(ctx, i * h / 10, h / 22, cols[i % 4], w);
        for (let i = 0; i < 300; i++) { ctx.fillStyle = cols[i % 2 ? 1 : 2]; ctx.beginPath(); ctx.arc(r() * w, r() * h, 2.5, 0, 7); ctx.fill(); }
    },
    brocade(ctx, w, h, base) {
        ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#d9b14a';
        for (let y = 0; y < h; y += 32) for (let x = 0; x < w; x += 32) {
            const ox = x + ((y / 32) % 2) * 16;
            for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; ctx.beginPath(); ctx.ellipse(ox + Math.cos(a) * 6, y + Math.sin(a) * 6, 4, 2, a, 0, 7); ctx.fill(); }
        }
    },
    bayeux(ctx, w, h, base, accent, r) {
        ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
        band(ctx, h * 0.12, 3, '#3f5a3a', w); band(ctx, h * 0.86, 3, '#3f5a3a', w);
        const cols = ['#9c3b2a', '#3f5a3a', '#2c3f6b', '#c9a04a'];
        for (let i = 0; i < 4; i++) {
            const x = 40 + i * (w - 80) / 3, y = h * 0.6;
            ctx.fillStyle = cols[i % 4];
            ctx.beginPath(); ctx.ellipse(x, y, 34, 16, 0, 0, 7); ctx.fill();
            ctx.fillRect(x - 28, y + 8, 6, 30); ctx.fillRect(x + 22, y + 8, 6, 30);
            ctx.beginPath(); ctx.ellipse(x + 38, y - 14, 10, 18, -0.5, 0, 7); ctx.fill();
            ctx.fillStyle = cols[(i + 1) % 4]; ctx.fillRect(x - 6, y - 40, 10, 30);
            ctx.beginPath(); ctx.arc(x - 1, y - 46, 8, 0, 7); ctx.fill();
        }
    },
    floral(ctx, w, h, base, accent, r) {
        ctx.fillStyle = '#f6f4ee'; ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 18; i++) {
            const x = r() * w, y = r() * h, c = ['#c8312b', '#2a5a9a', '#d9b14a', '#3f7a3a'][i % 4];
            ctx.fillStyle = c;
            for (let k = 0; k < 5; k++) { const a = k * Math.PI * 0.4; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * 7, y + Math.sin(a) * 7, 6, 3.5, a, 0, 7); ctx.fill(); }
            ctx.fillStyle = '#d9b14a'; ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill();
        }
        band(ctx, 4, 6, '#d9b14a', w);
    },
    granular(ctx, w, h, base, accent, r) {
        ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
        for (let y = 8; y < h; y += 14) for (let x = 8; x < w; x += 14) {
            ctx.fillStyle = shade(base, 1.35); ctx.beginPath(); ctx.arc(x + ((y / 14) % 2) * 7, y, 4, 0, 7); ctx.fill();
            ctx.fillStyle = shade(base, 0.55); ctx.beginPath(); ctx.arc(x + ((y / 14) % 2) * 7 + 1.5, y + 1.5, 4, 0, 7); ctx.fill();
        }
    },
    geometric(ctx, w, h, base) {
        ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
        stars(ctx, w, h, [shade(base, 0.6), shade(base, 1.25), shade(base, 0.85)], 56);
    },
    sunstone(ctx, w, h, base, accent, r) {
        ctx.fillStyle = base; ctx.fillRect(0, 0, w, h); grain(ctx, w, h, r, 0.1);
        ctx.strokeStyle = shade(base, 0.45); ctx.lineWidth = 5;
        const cx = w / 2, cy = h / 2;
        for (let k = 1; k < 6; k++) { ctx.beginPath(); ctx.arc(cx, cy, k * 22, 0, 7); ctx.stroke(); }
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 10) { ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 44, cy + Math.sin(a) * 44); ctx.lineTo(cx + Math.cos(a) * 110, cy + Math.sin(a) * 110); ctx.stroke(); }
    },
    glazedbrick(ctx, w, h, base, accent, r) {
        tiles(ctx, w, h, ['#1f4f9a', '#23579f', '#1c4891'], 32, r, '#163463');
        ctx.fillStyle = '#e3b23c';
        const cx = w / 2, cy = h * 0.55;
        ctx.beginPath(); ctx.ellipse(cx, cy, 90, 32, 0, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx + 92, cy - 22, 30, 26, 0, 0, 7); ctx.fill();
        for (const dx of [-70, -40, 50, 75]) ctx.fillRect(cx + dx, cy + 20, 14, 48);
        ctx.fillStyle = '#efe6d0'; ctx.beginPath(); ctx.ellipse(cx + 80, cy - 34, 34, 30, 0, Math.PI, 0); ctx.fill();
    },
    embossed(ctx, w, h, base, accent, r) {
        ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
        ctx.save(); ctx.translate(2, 2); figures(ctx, h * 0.25, h * 0.5, shade(base, 0.6), w, r, 5); ctx.restore();
        figures(ctx, h * 0.25, h * 0.5, shade(base, 1.3), w, r, 5);
    },
    lustre(ctx, w, h, base, accent, r) {
        ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
        scrolls(ctx, w, h, '#a8752c', r, 18, 26);
        ctx.strokeStyle = '#2a4f8f'; ctx.lineWidth = 4; ctx.strokeRect(8, 8, w - 16, h - 16);
    },
    geez(ctx, w, h, base, accent, r) {
        ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
        glyphRows(ctx, w, h, '#2b1d14', 'geez', r);
        ctx.fillStyle = '#9c2a22'; ctx.fillRect(w * 0.06, h * 0.05, w * 0.88, 8);
    },
};

const ALIAS = {
    blackfigure: 'meander', fezblue: 'bluewhite', hieroglyphs: 'glyphs', cuneiform: 'glyphs', runes: 'glyphs',
    mayaglyphs: 'glyphs', oracle: 'glyphs', indus: 'glyphs',
};

const GLYPH_STYLE = { hieroglyphs: 'hieroglyphs', cuneiform: 'cuneiform', runes: 'runes', mayaglyphs: 'mayaglyphs', oracle: 'oracle', indus: 'indus' };

export function patternTexture(name, baseColor, accentColor = 0xd9a93b, seed = 1) {
    const key = `${name}:${baseColor}:${accentColor}:${seed}`;
    if (cache.has(key)) return cache.get(key);
    const drawName = DRAW[name] ? name : ALIAS[name];
    if (!drawName) return null;
    const [c, ctx] = canvas(512, 256);
    DRAW[drawName](ctx, c.width, c.height, hex(baseColor), hex(accentColor), rng(seed), GLYPH_STYLE[name] || name);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.anisotropy = 4;
    cache.set(key, tex);
    return tex;
}
