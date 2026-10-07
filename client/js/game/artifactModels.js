// ============================================
// ARTIFACT MODELS — procedural low-poly artifacts built from the catalog.
// One builder per shape (with variants). Models are normalised to fit a
// 0.42-unit box centred on the origin, so they sit inside one excavation unit.
// ============================================

import * as THREE from 'three';
import { MATERIALS } from '../data/catalog.js';
import { patternTexture } from './patterns.js';

const TARGET_SIZE = 0.42;
const V2 = (x, y) => new THREE.Vector2(x, y);
const DARK = 0x16110d;

function hashId(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return h >>> 0;
}

// ---------- materials ----------

function makeMaterial(key, { color, map, envMap, side } = {}) {
    const def = MATERIALS[key] || MATERIALS.stone;
    const mat = new THREE.MeshStandardMaterial({
        color: color ?? def.color,
        metalness: def.metalness,
        roughness: def.roughness,
        map: map || null,
        envMap: envMap || null,
        envMapIntensity: def.metalness > 0.5 ? 1.15 : 0.55,
        side: side || THREE.FrontSide,
        transparent: key === 'glass',
        opacity: key === 'glass' ? 0.72 : 1,
    });
    mat.userData.base = { color: mat.color.clone(), roughness: mat.roughness, metalness: mat.metalness, emissive: mat.emissive.clone() };
    return mat;
}

function materialsFor(entry, envMap) {
    const def = MATERIALS[entry.mat] || MATERIALS.stone;
    const baseColor = entry.color ?? def.color;
    const accentKey = entry.accent || (def.metalness > 0.5 ? 'gold' : entry.mat === 'gold' ? 'lapis' : 'bronze');
    const pattern = entry.pattern ? patternTexture(entry.pattern, baseColor, MATERIALS[accentKey]?.color, hashId(entry.id)) : null;
    return {
        main: makeMaterial(entry.mat, { color: baseColor, envMap }),
        patterned: makeMaterial(entry.mat, { color: pattern ? 0xffffff : baseColor, map: pattern, envMap }),
        accent: makeMaterial(accentKey, { envMap }),
        dark: makeMaterial('basalt', { color: DARK }),
        pattern,
        accentKey,
    };
}

// ---------- geometry helpers ----------

class Kit {
    constructor(group, m) { this.g = group; this.m = m; }

    mesh(geo, mat, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
        const resolve = x => (typeof x === 'string' ? this.m[x] : x);
        const mesh = new THREE.Mesh(geo, Array.isArray(mat) ? mat.map(resolve) : resolve(mat));
        mesh.position.set(...pos);
        mesh.rotation.set(...rot);
        mesh.scale.set(...scale);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.g.add(mesh);
        return mesh;
    }
    lathe(points, mat = 'main', seg = 28, pos, rot, scale) {
        return this.mesh(new THREE.LatheGeometry(points.map(([x, y]) => V2(x, y)), seg), mat, pos, rot, scale);
    }
    cyl(rt, rb, hgt, mat = 'main', pos, rot, seg = 20, scale) {
        return this.mesh(new THREE.CylinderGeometry(rt, rb, hgt, seg), mat, pos, rot, scale);
    }
    sph(r, mat = 'main', pos, scale, seg = 18) {
        return this.mesh(new THREE.SphereGeometry(r, seg, Math.max(8, seg * 0.66 | 0)), mat, pos, [0, 0, 0], scale);
    }
    box(w, hgt, d, mat = 'main', pos, rot) {
        return this.mesh(new THREE.BoxGeometry(w, hgt, d), mat, pos, rot);
    }
    torus(R, r, mat = 'main', pos, rot, arc = Math.PI * 2, scale) {
        return this.mesh(new THREE.TorusGeometry(R, r, 10, 28, arc), mat, pos, rot, scale);
    }
    cone(r, hgt, mat = 'main', pos, rot, seg = 16) {
        return this.mesh(new THREE.ConeGeometry(r, hgt, seg), mat, pos, rot);
    }
    extrude(shape, depth, mat = 'main', pos, rot, bevel = 0.01) {
        const geo = new THREE.ExtrudeGeometry(shape, {
            depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 16,
        });
        geo.translate(0, 0, -depth / 2);
        return this.mesh(geo, mat, pos, rot);
    }
    /** Flat panel with the pattern texture on its front face. */
    slab(w, hgt, d, pos, rot) {
        const mats = [this.m.main, this.m.main, this.m.main, this.m.main, this.m.patterned, this.m.main];
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, d), mats);
        mesh.position.set(...(pos || [0, 0, 0]));
        mesh.rotation.set(...(rot || [0, 0, 0]));
        mesh.castShadow = mesh.receiveShadow = true;
        this.g.add(mesh);
        return mesh;
    }
}

function shapeFrom(points) {
    const s = new THREE.Shape();
    points.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
    s.closePath();
    return s;
}

function jitterGeometry(geo, amount, seed) {
    let s = seed;
    const r = () => ((s = Math.imul(s ^ (s >>> 13), 1274126177) >>> 0) / 4294967296) - 0.5;
    const pos = geo.attributes.position;
    const seen = new Map();
    for (let i = 0; i < pos.count; i++) {
        const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
        if (!seen.has(key)) seen.set(key, [r() * amount, r() * amount, r() * amount]);
        const [dx, dy, dz] = seen.get(key);
        pos.setXYZ(i, pos.getX(i) + dx, pos.getY(i) + dy, pos.getZ(i) + dz);
    }
    geo.computeVertexNormals();
    return geo;
}

// ---------- builders ----------

function humanoid(k, { robe = 'main', head = 'main', seated = false, height = 1, armsUp = false } = {}) {
    const hgt = height;
    if (seated) {
        k.lathe([[0, 0], [0.42, 0], [0.44, 0.08], [0.36, 0.22], [0.2, 0.34], [0, 0.36]], robe, 24);
        k.lathe([[0, 0.3], [0.2, 0.3], [0.22, 0.5], [0.16, 0.72], [0.1, 0.8], [0, 0.82]], robe, 24);
        k.sph(0.13, head, [0, 0.93, 0]);
        return 1.06;
    }
    k.lathe([[0, 0], [0.26, 0], [0.24, 0.5 * hgt], [0.17, 0.82 * hgt], [0.12, 0.9 * hgt], [0, 0.92 * hgt]], robe, 22);
    k.sph(0.13, head, [0, 1.03 * hgt, 0]);
    const armY = 0.78 * hgt;
    for (const s of [-1, 1]) {
        k.cyl(0.05, 0.045, 0.45, robe, [s * 0.22, armsUp ? armY + 0.12 : armY - 0.16, 0], [0, 0, armsUp ? s * 2.4 : s * 0.25]);
    }
    return 1.16 * hgt;
}

const BUILD = {
    vase(k, e) {
        const v = e.variant;
        const profiles = {
            amphora: [[0, 0], [0.13, 0], [0.12, 0.05], [0.3, 0.3], [0.36, 0.55], [0.3, 0.78], [0.14, 0.9], [0.11, 1.08], [0.15, 1.12], [0.12, 1.14]],
            canopic: [[0, 0], [0.2, 0], [0.24, 0.1], [0.28, 0.45], [0.25, 0.75], [0.2, 0.8], [0, 0.8]],
            meiping: [[0, 0], [0.16, 0], [0.2, 0.15], [0.3, 0.6], [0.32, 0.78], [0.16, 0.95], [0.08, 1], [0.1, 1.06], [0, 1.06]],
            cylinder: [[0, 0], [0.26, 0], [0.27, 0.04], [0.27, 0.86], [0.29, 0.9], [0.26, 0.9]],
            urn: [[0, 0], [0.16, 0], [0.12, 0.08], [0.16, 0.14], [0.34, 0.4], [0.34, 0.62], [0.24, 0.8], [0.26, 0.86], [0, 0.88]],
            globular: [[0, 0], [0.16, 0], [0.32, 0.18], [0.36, 0.38], [0.3, 0.58], [0.16, 0.7], [0.14, 0.78], [0.17, 0.82], [0.14, 0.82]],
            kantharos: [[0, 0], [0.14, 0], [0.06, 0.1], [0.06, 0.24], [0.28, 0.36], [0.32, 0.6], [0.3, 0.64]],
            tulip: [[0, 0], [0.26, 0], [0.24, 0.2], [0.18, 0.22], [0.2, 0.42], [0.14, 0.44], [0.15, 0.62], [0.1, 0.64], [0.1, 0.8], [0.07, 0.8]],
            samovar: [[0, 0], [0.18, 0], [0.12, 0.1], [0.26, 0.16], [0.3, 0.5], [0.24, 0.66], [0.1, 0.72], [0.12, 0.84], [0, 0.88]],
            teapot: [[0, 0], [0.18, 0], [0.28, 0.12], [0.3, 0.3], [0.2, 0.46], [0.08, 0.5], [0.06, 0.62], [0, 0.66]],
            ewer: [[0, 0], [0.16, 0], [0.26, 0.2], [0.24, 0.44], [0.1, 0.62], [0.08, 0.86], [0.13, 0.92], [0.1, 0.93]],
            jebena: [[0, 0], [0.16, 0], [0.3, 0.16], [0.3, 0.34], [0.16, 0.48], [0.06, 0.56], [0.06, 0.84], [0.09, 0.88], [0.06, 0.88]],
            stirrup: [[0, 0], [0.18, 0], [0.3, 0.18], [0.32, 0.38], [0.24, 0.56], [0, 0.6]],
            poporo: [[0, 0], [0.12, 0], [0.26, 0.14], [0.28, 0.3], [0.2, 0.46], [0.06, 0.52], [0.05, 0.86], [0.08, 0.9], [0.05, 0.9]],
        };
        const prof = profiles[v] || profiles.amphora;
        const body = k.lathe(prof, k.m.pattern ? 'patterned' : 'main', 30);
        const top = prof[prof.length - 1][1];
        if (v === 'amphora' || !v || v === 'kantharos') {
            for (const s of [-1, 1]) k.torus(0.13, 0.025, 'main', [s * 0.25, v === 'kantharos' ? 0.52 : 0.92, 0], [0, 0, s * -0.4], Math.PI * 1.3);
        }
        if (v === 'canopic') {
            k.sph(0.2, 'main', [0, 0.92, 0], [1, 1.05, 1]);
            k.box(0.42, 0.16, 0.08, 'accent', [0, 0.9, -0.1]);
        }
        if (v === 'urn' || v === 'samovar') k.sph(0.08, 'accent', [0, top + 0.06, 0]);
        if (v === 'samovar') {
            k.cyl(0.03, 0.03, 0.18, 'accent', [0.32, 0.3, 0], [0, 0, Math.PI / 2]);
            for (const s of [-1, 1]) k.torus(0.07, 0.015, 'accent', [s * 0.3, 0.58, 0], [Math.PI / 2, 0, 0], Math.PI);
        }
        if (['teapot', 'ewer', 'jebena'].includes(v)) {
            k.cyl(0.025, 0.05, 0.36, 'main', [0.33, v === 'jebena' ? 0.36 : 0.4, 0], [0, 0, -0.9]);
            k.torus(0.14, 0.022, 'main', [-0.26, v === 'teapot' ? 0.3 : 0.5, 0], [0, 0, Math.PI / 2], Math.PI);
            if (v === 'teapot') k.cone(0.08, 0.14, 'main', [0, 0.72, 0]);
        }
        if (v === 'stirrup') {
            k.torus(0.14, 0.035, 'main', [0, 0.66, 0], [0, 0, 0], Math.PI);
            k.cyl(0.035, 0.04, 0.22, 'main', [0, 0.86, 0]);
            for (const s of [-1, 1]) k.sph(0.04, 'dark', [s * 0.1, 0.36, 0.27]);
            k.box(0.06, 0.1, 0.06, 'main', [0, 0.28, 0.3]);
        }
        if (v === 'tulip') {
            for (let i = 0; i < 6; i++) {
                const a = (i / 6) * Math.PI * 2;
                k.cyl(0.02, 0.03, 0.12, 'patterned', [Math.cos(a) * 0.2, 0.24, Math.sin(a) * 0.2], [Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4]);
            }
        }
        return body;
    },

    pottery(k, e) {
        const v = e.variant;
        const profiles = {
            plate: [[0, 0], [0.24, 0], [0.26, 0.03], [0.46, 0.08], [0.5, 0.1], [0.48, 0.11], [0.24, 0.05], [0, 0.04]],
            teabowl: [[0, 0], [0.16, 0], [0.18, 0.05], [0.3, 0.12], [0.32, 0.44], [0.3, 0.46], [0.27, 0.16], [0, 0.12]],
            moonjar: [[0, 0], [0.18, 0], [0.38, 0.2], [0.42, 0.44], [0.36, 0.7], [0.2, 0.84], [0.2, 0.9], [0, 0.9]],
            beaker: [[0, 0], [0.14, 0], [0.26, 0.2], [0.18, 0.34], [0.2, 0.6], [0.3, 0.8], [0.28, 0.8]],
            urn: [[0, 0], [0.2, 0], [0.38, 0.3], [0.36, 0.6], [0.2, 0.76], [0.22, 0.8], [0, 0.82]],
            globular: [[0, 0], [0.14, 0], [0.34, 0.2], [0.38, 0.4], [0.28, 0.6], [0.14, 0.66], [0.16, 0.72], [0.12, 0.72]],
            bowl: [[0, 0], [0.16, 0], [0.18, 0.04], [0.36, 0.16], [0.42, 0.34], [0.4, 0.35], [0.33, 0.18], [0, 0.12]],
            caryatid: [[0, 0.28], [0.2, 0.28], [0.36, 0.38], [0.42, 0.56], [0.4, 0.57], [0.3, 0.42], [0, 0.4]],
        };
        k.lathe(profiles[v] || profiles.bowl, k.m.pattern ? 'patterned' : 'main', 32);
        if (v === 'caryatid') {
            for (let i = 0; i < 3; i++) {
                const a = (i / 3) * Math.PI * 2;
                k.cyl(0.04, 0.06, 0.3, 'main', [Math.cos(a) * 0.16, 0.14, Math.sin(a) * 0.16]);
                k.sph(0.05, 'main', [Math.cos(a) * 0.2, 0.32, Math.sin(a) * 0.2]);
            }
        }
    },

    coin(k, e) {
        const v = e.variant;
        const big = v === 'large';
        const r = big ? 0.5 : v === 'small' ? 0.32 : 0.4;
        const t = big ? 0.14 : 0.06;
        const faceMat = k.m.pattern ? 'patterned' : 'main';
        if (v === 'bi') {
            const ring = new THREE.Shape(); ring.absarc(0, 0, 0.42, 0, Math.PI * 2);
            const hole = new THREE.Path(); hole.absarc(0, 0, 0.14, 0, Math.PI * 2, true); ring.holes.push(hole);
            k.extrude(ring, 0.06, 'main', [0, 0, 0], [0, 0, 0], 0.012);
            return;
        }
        k.cyl(r, r, t, faceMat, [0, 0, 0], [Math.PI / 2, 0, 0], 40);
        k.torus(r - 0.01, 0.022, 'main', [0, 0, t / 2], [0, 0, 0]);
        if (v === 'skydisc') {
            k.cyl(0.13, 0.13, 0.02, 'accent', [-0.1, 0.12, t / 2 + 0.005], [Math.PI / 2, 0, 0], 28);
            const crescent = new THREE.Shape(); crescent.absarc(0, 0, 0.14, 0.4, Math.PI * 2 - 0.4);
            const bite = new THREE.Path(); bite.absarc(0.07, 0, 0.11, 0, Math.PI * 2, true); crescent.holes.push(bite);
            k.extrude(crescent, 0.01, 'accent', [0.16, -0.08, t / 2 + 0.005], [0, 0, 0], 0);
            for (let i = 0; i < 9; i++) k.cyl(0.02, 0.02, 0.012, 'accent', [Math.cos(i * 2.3) * 0.3, Math.sin(i * 1.7) * 0.28, t / 2 + 0.005], [Math.PI / 2, 0, 0], 8);
            k.torus(0.34, 0.012, 'accent', [0, 0, t / 2], [0, 0, 0.6], 1.4);
        } else if (v === 'sun') {
            for (let i = 0; i < 16; i++) {
                const a = (i / 16) * Math.PI * 2;
                k.cone(0.05, 0.16, 'main', [Math.cos(a) * 0.46, Math.sin(a) * 0.46, 0], [0, 0, a - Math.PI / 2], 4);
            }
            k.sph(0.13, 'main', [0, 0, 0.04], [1, 1, 0.5]);
        } else if (v === 'bracteate' || v === 'gorget') {
            k.torus(0.06, 0.018, 'main', [0, r + 0.04, 0], [0, 0, 0]);
            k.sph(0.16, 'main', [0, 0, t / 2], [1, 1, 0.25]);
        } else {
            k.sph(0.16, 'main', [0, 0.02, t / 2], [0.85, 1, 0.3]);
            k.box(0.24, 0.04, 0.02, 'main', [0, -0.2, t / 2]);
        }
    },

    mask(k, e) {
        const v = e.variant;
        const face = k.mesh(new THREE.SphereGeometry(0.4, 26, 18, 0, Math.PI), k.m.pattern ? 'patterned' : 'main', [0, 0, 0], [0, 0, 0], [0.82, 1.08, 0.55]); // phi 0..π is the front (+z) half
        face.material.side = THREE.DoubleSide;
        const eye = v === 'gelede' || v === 'sican' ? 'accent' : 'dark';
        for (const s of [-1, 1]) {
            k.sph(0.06, eye, [s * 0.13, 0.1, 0.19], v === 'theatre' ? [1.3, 1, 0.5] : [1.4, 0.7, 0.5]);
            if (v === 'barong' || v === 'khon') k.sph(0.075, 'accent', [s * 0.13, 0.12, 0.2], [1, 1, 0.8]);
        }
        k.cone(0.06, 0.18, 'main', [0, -0.02, 0.21], [-0.35, 0, 0], 4);
        if (v === 'theatre') k.torus(0.08, 0.025, 'dark', [0, -0.2, 0.17], [0, 0, 0]);
        else k.box(0.16, 0.025, 0.04, 'dark', [0, -0.21, 0.18]);
        if (!v || v === 'sican') {
            for (const s of [-1, 1]) k.box(0.2, 0.42, 0.04, k.m.pattern ? 'patterned' : 'accent', [s * 0.38, -0.1, -0.05], [0, s * 0.35, 0]);
            k.box(0.7, 0.14, 0.12, k.m.pattern ? 'patterned' : 'accent', [0, 0.38, 0]);
            k.cyl(0.07, 0.05, 0.3, 'accent', [0, -0.48, 0.05]);
        }
        if (v === 'sican') for (const s of [-1, 1]) k.box(0.3, 0.12, 0.02, 'main', [s * 0.48, 0.1, 0]);
        if (v === 'khon') k.cone(0.16, 0.6, 'accent', [0, 0.66, 0]);
        if (v === 'barong') { k.box(0.6, 0.1, 0.1, 'accent', [0, 0.38, 0.05]); k.box(0.28, 0.06, 0.05, 'accent', [0, -0.28, 0.17]); }
        if (v === 'gelede') k.box(0.7, 0.18, 0.5, 'accent', [0, 0.44, -0.05]);
        if (v === 'noh') face.scale.set(0.72, 1.04, 0.5);
    },

    head(k, e) {
        const v = e.variant;
        const mat = k.m.pattern ? 'patterned' : 'main';
        k.box(0.42, 0.12, 0.38, 'main', [0, -0.5, 0]);
        k.cyl(0.12, 0.15, 0.24, mat, [0, -0.34, 0]);
        if (v === 'bust') k.lathe([[0, -0.44], [0.4, -0.44], [0.36, -0.32], [0.14, -0.22], [0, -0.22]], 'main', 24);
        const headScale = v === 'nok' ? [0.85, 1.15, 0.95] : v === 'olmec' ? [1.1, 1, 1] : [0.88, 1.05, 0.95];
        k.sph(0.25, mat, [0, 0, 0], headScale, 24);
        for (const s of [-1, 1]) {
            k.sph(0.035, 'dark', [s * 0.09, 0.03, 0.22], v === 'nok' ? [1.5, 0.8, 0.5] : [1.2, 0.6, 0.5]);
            k.sph(0.05, mat, [s * 0.24, 0, 0], [0.4, 1, 0.7]);
        }
        k.cone(0.045, 0.12, mat, [0, -0.04, 0.25], [-0.4, 0, 0], 5);
        k.box(0.1, 0.02, 0.03, 'dark', [0, -0.13, 0.22]);
        if (v === 'buddha') {
            k.sph(0.12, mat, [0, 0.25, -0.02]);
            k.cone(0.04, 0.14, mat, [0, 0.38, -0.02]);
            for (let i = 0; i < 18; i++) {
                const a = i * 0.7, b = (i % 3) * 0.35 + 0.2;
                k.sph(0.025, mat, [Math.cos(a) * 0.22 * Math.cos(b), 0.12 + Math.sin(b) * 0.12, Math.sin(a) * 0.2 * Math.cos(b)]);
            }
        } else if (v === 'olmec') {
            k.sph(0.27, mat, [0, 0.07, -0.02], [1.12, 0.62, 1.05]);
        } else if (v === 'benin') {
            k.cyl(0.2, 0.17, 0.2, 'main', [0, 0.18, 0], [0, 0, 0], 22);
            for (let i = 0; i < 4; i++) k.torus(0.16, 0.02, 'main', [0, -0.2 - i * 0.05, 0], [Math.PI / 2, 0, 0]);
            k.sph(0.06, 'main', [0, 0.32, 0]);
        } else if (v === 'gargoyle') {
            k.box(0.2, 0.14, 0.26, mat, [0, -0.08, 0.26]);
            for (const s of [-1, 1]) k.cone(0.05, 0.18, mat, [s * 0.14, 0.26, 0], [0, 0, -s * 0.4]);
        } else if (v === 'elche') {
            for (const s of [-1, 1]) k.cyl(0.18, 0.18, 0.08, 'main', [s * 0.3, -0.02, 0], [0, 0, Math.PI / 2], 24);
            k.cone(0.26, 0.24, 'main', [0, 0.2, -0.02]);
        } else if (v === 'bayon') {
            k.cone(0.24, 0.3, mat, [0, 0.36, 0], [0, 0, 0], 8);
        } else if (v === 'nok') {
            k.cone(0.12, 0.2, mat, [0, 0.3, -0.04], [-0.3, 0, 0], 8);
        }
    },

    sword(k, e) {
        const v = e.variant;
        const blade = (len, w, curve = 0, wavy = 0, tip = 0.12) => {
            const pts = [];
            const n = 24;
            for (let i = 0; i <= n; i++) {
                const t = i / n;
                const y = t * len;
                const off = curve * t * t + Math.sin(t * Math.PI * 7) * wavy;
                const half = (t > 1 - tip ? w * (1 - (t - (1 - tip)) / tip) : w) / 2;
                pts.push([off + half, y]);
            }
            for (let i = n; i >= 0; i--) {
                const t = i / n;
                const y = t * len;
                const off = curve * t * t + Math.sin(t * Math.PI * 7) * wavy;
                const half = (t > 1 - tip ? w * (1 - (t - (1 - tip)) / tip) * (curve ? 0.2 : 1) : w) / 2;
                pts.push([off - half, y]);
            }
            return shapeFrom(pts);
        };
        const cfg = {
            katana: { len: 1.4, w: 0.07, curve: 0.08, guard: 'disc', grip: 0.36 },
            short: { len: 0.7, w: 0.12, guard: 'bar', grip: 0.2, tip: 0.18 },
            long: { len: 1.6, w: 0.1, guard: 'bar', grip: 0.46 },
            rapier: { len: 1.4, w: 0.04, guard: 'ring', grip: 0.24 },
            sabre: { len: 1.2, w: 0.07, curve: 0.18, guard: 'bar', grip: 0.24 },
            kilij: { len: 1.0, w: 0.09, curve: 0.24, guard: 'bar', grip: 0.24 },
            dagger: { len: 0.55, w: 0.1, guard: 'bar', grip: 0.2 },
            keris: { len: 0.8, w: 0.09, wavy: 0.025, guard: 'none', grip: 0.2 },
            mandolin: { len: 0.6, w: 0.2, guard: 'none', grip: 0.16, tip: 0.5 },
            viking: { len: 1.1, w: 0.12, guard: 'bar', grip: 0.24, tip: 0.1 },
        }[v] || { len: 1.2, w: 0.1, guard: 'bar', grip: 0.26 };

        if (v === 'club') {
            k.lathe([[0, 0], [0.04, 0], [0.05, 0.7], [0.14, 0.9], [0.16, 1.05], [0.1, 1.15], [0, 1.16]], 'main', 18, [0, -0.6, 0]);
            k.box(0.3, 0.08, 0.06, 'main', [0, 0.36, 0]);
            return;
        }
        k.extrude(blade(cfg.len, cfg.w, cfg.curve || 0, cfg.wavy || 0, cfg.tip || 0.12), 0.018, e.mat === 'bronze' ? 'main' : 'main', [0, 0, 0], [0, 0, 0], 0.006);
        if (v === 'viking' || !v) k.box(0.025, cfg.len * 0.7, 0.024, 'dark', [0, cfg.len * 0.38, 0]);
        if (cfg.guard === 'bar') k.box(v === 'kilij' || v === 'sabre' ? 0.22 : 0.32, 0.04, 0.06, 'accent', [0, -0.02, 0]);
        if (cfg.guard === 'disc') k.cyl(0.08, 0.08, 0.025, 'accent', [0, -0.01, 0], [0, 0, 0], 20);
        if (cfg.guard === 'ring') { k.box(0.24, 0.03, 0.04, 'accent', [0, -0.02, 0]); k.torus(0.1, 0.012, 'accent', [0.06, -0.1, 0], [0, 0, 0], Math.PI * 1.4); }
        const gripMat = v === 'dagger' && e.accent === 'jade' ? 'accent' : v === 'katana' ? 'dark' : 'accent';
        k.cyl(0.03, 0.034, cfg.grip, gripMat, [0, -cfg.grip / 2 - 0.03, 0]);
        if (v === 'keris') k.sph(0.06, 'accent', [0.03, -cfg.grip - 0.04, 0], [1.4, 1, 0.8]);
        else k.sph(v === 'viking' ? 0.06 : 0.045, 'accent', [0, -cfg.grip - 0.05, 0], v === 'viking' ? [1.5, 0.8, 0.6] : [1, 1, 1]);
    },

    axe(k, e) {
        const v = e.variant;
        if (v === 'tumi') {
            const blade = new THREE.Shape(); blade.absarc(0, 0, 0.3, Math.PI * 1.08, Math.PI * 1.92); blade.lineTo(0, -0.12); blade.closePath();
            k.extrude(blade, 0.03, 'main', [0, -0.1, 0]);
            k.box(0.12, 0.5, 0.05, 'main', [0, 0.16, 0]);
            k.box(0.22, 0.2, 0.06, 'main', [0, 0.5, 0]);
            k.sph(0.08, 'main', [0, 0.66, 0]);
            for (let i = 0; i < 5; i++) k.box(0.03, 0.16, 0.03, 'main', [-0.12 + i * 0.06, 0.82, 0]);
            return;
        }
        if (v === 'money') {
            // thin T-shaped blade, too fragile to cut
            const pts = [[-0.22, 0.5], [0.22, 0.5], [0.22, 0.42], [0.08, 0.34], [0.36, -0.5], [-0.36, -0.5], [-0.08, 0.34], [-0.22, 0.42]];
            k.extrude(shapeFrom(pts), 0.012, 'main', [0, 0, 0], [0, 0, 0], 0.004);
            return;
        }
        if (v === 'razor') {
            const blade = new THREE.Shape(); blade.absarc(0, 0, 0.32, 0.2, Math.PI - 0.2); blade.closePath();
            k.extrude(blade, 0.015, 'main');
            k.box(0.08, 0.26, 0.02, 'main', [0.2, -0.1, 0], [0, 0, 0.6]);
            k.torus(0.06, 0.012, 'main', [0.3, -0.22, 0]);
            return;
        }
        k.cyl(0.035, 0.04, 1.1, makeMaterial('wood'), [0, 0, 0]);
        const head = shapeFrom([[0, 0.12], [0.18, 0.18], [0.36, 0.34], [0.38, -0.2], [0.18, -0.08], [0, -0.06]]);
        k.extrude(head, 0.04, 'main', [0.02, 0.36, 0]);
        if (e.accent) k.box(0.2, 0.05, 0.05, 'accent', [0.16, 0.38, 0]);
    },

    point(k, e) {
        const v = e.variant;
        const len = v === 'dagger' ? 1.1 : v === 'blade' ? 0.9 : v === 'bodkin' ? 0.55 : 0.7;
        const w = v === 'bodkin' ? 0.08 : v === 'blade' ? 0.16 : 0.28;
        const pts = [];
        for (let i = 0; i <= 16; i++) {
            const t = i / 16;
            pts.push([Math.sin(t * Math.PI) ** (v === 'clovis' ? 0.7 : 0.9) * w / 2 * (1 - t * 0.35), t * len]);
        }
        for (let i = 16; i >= 0; i--) {
            const t = i / 16;
            pts.push([-(Math.sin(t * Math.PI) ** (v === "clovis" ? 0.7 : 0.9)) * w / 2 * (1 - t * 0.35), t * len]);
        }
        const geo = new THREE.ExtrudeGeometry(shapeFrom(pts), { depth: 0.04, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.02, bevelSegments: 1 });
        geo.translate(0, 0, -0.02);
        if (e.mat !== 'iron') jitterGeometry(geo, 0.018, hashId(e.id));
        k.mesh(geo, 'main');
        if (v === 'bodkin') k.cyl(0.04, 0.03, 0.2, 'main', [0, -0.08, 0]);
        if (v === 'dagger') k.box(0.12, 0.3, 0.06, 'main', [0, 0.05, 0]);
    },

    stonetool(k, e) {
        const geo = new THREE.IcosahedronGeometry(0.4, 1);
        geo.scale(1, e.variant === 'axehead' ? 0.62 : 0.8, 0.42);
        jitterGeometry(geo, e.variant === 'axehead' ? 0.05 : 0.14, hashId(e.id));
        const m = k.mesh(geo, 'main');
        m.material.flatShading = true;
        if (e.variant === 'axehead') k.box(0.5, 0.02, 0.2, 'main', [0.12, -0.24, 0], [0, 0, 0.2]);
    },

    statue(k, e) {
        const v = e.variant;
        k.cyl(0.32, 0.36, 0.1, 'main', [0, -0.05, 0], [0, 0, 0], 24);
        const robe = k.m.pattern ? 'patterned' : 'main';
        if (v === 'seated' || v === 'buddha') {
            humanoid(k, { robe, seated: true });
            if (v === 'buddha') { k.sph(0.07, robe, [0, 1.08, 0]); k.torus(0.3, 0.02, 'main', [0, 0.95, -0.08], [0, 0, 0]); }
            return;
        }
        if (v === 'nataraja') {
            humanoid(k, { robe, height: 0.9, armsUp: true });
            k.torus(0.62, 0.03, 'main', [0, 0.62, -0.05], [0, 0, 0]);
            for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; k.cone(0.035, 0.1, 'main', [Math.cos(a) * 0.66, 0.62 + Math.sin(a) * 0.66, -0.05], [0, 0, a - Math.PI / 2], 5); }
            return;
        }
        if (v === 'haniwa') {
            k.cyl(0.2, 0.26, 0.8, robe, [0, 0.4, 0], [0, 0, 0], 20);
            k.sph(0.2, robe, [0, 0.94, 0]);
            for (const s of [-1, 1]) k.sph(0.04, 'dark', [s * 0.07, 0.96, 0.17]);
            k.sph(0.035, 'dark', [0, 0.86, 0.18], [1.3, 0.8, 0.5]);
            for (const s of [-1, 1]) k.cyl(0.05, 0.05, 0.3, robe, [s * 0.25, 0.55, 0.05], [0.3, 0, s * 0.4]);
            return;
        }
        const top = humanoid(k, { robe, height: v === 'chessman' ? 0.8 : 1 });
        if (v === 'warrior') {
            k.box(0.48, 0.3, 0.36, 'main', [0, 0.62, 0]);
            k.cyl(0.14, 0.14, 0.06, 'main', [0, top - 0.02, 0], [0, 0, 0], 16);
        } else if (v === 'angel') {
            for (const s of [-1, 1]) k.box(0.36, 0.5, 0.03, 'main', [s * 0.22, 0.72, -0.14], [0.2, s * 0.6, s * 0.2]);
        } else if (v === 'katsina') {
            k.box(0.4, 0.2, 0.06, 'accent', [0, top + 0.04, 0]);
            for (let i = 0; i < 5; i++) k.cone(0.03, 0.2, 'accent', [-0.16 + i * 0.08, top + 0.2, 0]);
            k.box(0.5, 0.06, 0.3, 'accent', [0, 0.45, 0]);
        } else if (v === 'lionman') {
            for (const s of [-1, 1]) k.cone(0.04, 0.1, robe, [s * 0.08, top + 0.04, 0]);
            k.box(0.12, 0.08, 0.1, robe, [0, top - 0.1, 0.1]);
        } else if (v === 'chessman') {
            k.box(0.5, 0.5, 0.1, 'main', [0, 0.3, -0.25]);
            k.cyl(0.13, 0.15, 0.08, 'main', [0, top - 0.02, 0], [0, 0, 0], 12);
        } else if (v === 'figurehead') {
            k.box(0.6, 0.3, 0.3, 'accent', [0, top - 0.05, 0]);
            k.sph(0.18, 'accent', [0, 0.7, 0.18]);
        } else if (v === 'guardian') {
            for (const s of [-1, 1]) k.cone(0.025, 0.08, makeMaterial('ivory'), [s * 0.05, top - 0.24, 0.11], [Math.PI, 0, 0], 5);
            k.box(0.3, 0.12, 0.3, 'main', [0, top + 0.06, 0]);
        } else if (v === 'deity') {
            k.cone(0.1, 0.28, 'main', [0, top + 0.18, 0], [0, 0, 0], 8);
            for (const s of [-1, 1]) k.cyl(0.04, 0.04, 0.42, 'main', [s * 0.3, 0.86, 0], [0, 0, s * 2.2]);
        } else if (v === 'carving') {
            k.box(0.5, 0.06, 0.3, 'main', [0, 0.02, 0]);
        }
    },

    helmet(k, e) {
        const v = e.variant;
        const dome = k.mesh(new THREE.SphereGeometry(0.4, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), 'main', [0, 0, 0], [0, 0, 0], [1, v === 'morion' ? 0.85 : 1.08, 1.08]);
        dome.material.side = THREE.DoubleSide;
        const rim = (r, y) => k.torus(r, 0.025, 'accent', [0, y, 0], [Math.PI / 2, 0, 0]);
        if (v === 'corinthian') {
            const shell = k.mesh(new THREE.CylinderGeometry(0.4, 0.34, 0.5, 28, 1, true, Math.PI * 0.62, Math.PI * 1.76), 'main', [0, -0.25, 0]);
            shell.material.side = THREE.DoubleSide;
            k.box(0.06, 0.34, 0.08, 'main', [0, -0.2, 0.36]);
            k.box(0.12, 0.6, 0.7, 'dark', [0, 0.5, 0]);
        } else if (v === 'kabuto') {
            rim(0.42, 0);
            for (let i = 0; i < 4; i++) k.mesh(new THREE.CylinderGeometry(0.44 + i * 0.07, 0.5 + i * 0.07, 0.07, 28, 1, true, Math.PI * 0.75, Math.PI * 1.5), 'accent', [0, -0.05 - i * 0.07, 0]).material.side = THREE.DoubleSide;
            for (const s of [-1, 1]) k.box(0.05, 0.5, 0.04, 'accent', [s * 0.16, 0.6, 0.3], [0, 0, s * 0.35]);
        } else if (v === 'roman') {
            rim(0.41, 0);
            k.box(0.7, 0.04, 0.3, 'main', [0, -0.02, -0.4], [0.3, 0, 0]);
            for (const s of [-1, 1]) k.box(0.04, 0.3, 0.22, 'main', [s * 0.4, -0.18, 0.12]);
            k.box(0.04, 0.2, 0.22, 'accent', [0, 0.48, 0]);
        } else if (v === 'suttonhoo' || v === 'vendel') {
            k.box(0.04, 0.06, 0.8, 'accent', [0, 0.44, 0], [0, 0, 0]);
            const mask = k.mesh(new THREE.CylinderGeometry(0.4, 0.36, 0.42, 24, 1, true, -Math.PI * 0.35, Math.PI * 0.7), 'main', [0, -0.21, 0]);
            mask.material.side = THREE.DoubleSide;
            for (const s of [-1, 1]) k.torus(0.07, 0.02, 'accent', [s * 0.12, -0.08, 0.38], [0, 0, 0]);
            k.box(0.05, 0.2, 0.04, 'accent', [0, -0.18, 0.4]);
        } else if (v === 'morion') {
            const brim = k.mesh(new THREE.TorusGeometry(0.5, 0.08, 6, 32), 'main', [0, -0.02, 0], [Math.PI / 2, 0, 0], [1.15, 0.75, 0.6]);
            k.box(0.04, 0.24, 0.72, 'main', [0, 0.4, 0]);
        } else if (v === 'viking') {
            rim(0.41, 0.02);
            k.box(0.04, 0.04, 0.84, 'main', [0, 0.38, 0], [0.5, 0, 0]);
            for (const s of [-1, 1]) k.torus(0.08, 0.025, 'main', [s * 0.12, -0.08, 0.37], [0, 0, 0]);
            k.box(0.05, 0.16, 0.04, 'main', [0, -0.14, 0.4]);
        } else {
            rim(0.41, 0);
        }
    },

    shield(k, e) {
        const v = e.variant;
        const front = k.m.pattern ? 'patterned' : 'main';
        if (v === 'heater') {
            const s = shapeFrom([[-0.4, 0.45], [0.4, 0.45], [0.38, -0.05], [0, -0.55], [-0.38, -0.05]]);
            const geo = new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02 });
            geo.translate(0, 0, -0.02);
            planarUV(geo);
            k.mesh(geo, [front, 'main']);
            return;
        }
        if (v === 'narrow') {
            k.sph(0.5, front, [0, 0, 0], [0.32, 1, 0.12], 20);
            k.box(0.04, 0.2, 0.06, 'main', [0, 0, -0.08]);
            return;
        }
        k.cyl(0.5, 0.5, 0.04, front, [0, 0, 0], [Math.PI / 2, 0, 0], 36);
        k.torus(0.49, 0.02, 'main', [0, 0, 0.02]);
        k.sph(0.13, v === 'round' ? 'main' : 'accent', [0, 0, 0.02], [1, 1, 0.8]);
    },

    gong(k) {
        k.cyl(0.48, 0.48, 0.05, 'main', [0, 0, 0], [Math.PI / 2, 0, 0], 40);
        k.mesh(new THREE.CylinderGeometry(0.48, 0.42, 0.12, 40, 1, true), 'main', [0, 0, -0.06], [Math.PI / 2, 0, 0]).material.side = THREE.DoubleSide;
        k.sph(0.12, 'main', [0, 0, 0.03], [1, 1, 0.7]);
        k.torus(0.2, 0.015, 'main', [0, 0, 0.03]);
    },

    tablet(k, e) {
        const v = e.variant;
        const front = k.m.pattern ? 'patterned' : 'main';
        if (v === 'stela' || v === 'keyhole') {
            const s = new THREE.Shape();
            s.moveTo(-0.32, -0.6); s.lineTo(0.32, -0.6);
            if (v === 'keyhole') { s.lineTo(0.22, -0.1); s.absarc(0, 0.25, 0.4, -0.5, Math.PI + 0.5, false); s.lineTo(-0.32, -0.6); }
            else { s.lineTo(0.32, 0.28); s.absarc(0, 0.28, 0.32, 0, Math.PI, false); s.lineTo(-0.32, -0.6); }
            const geo = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, curveSegments: 18 });
            geo.translate(0, 0, -0.06);
            planarUV(geo);
            k.mesh(geo, [front, 'main']);
            return;
        }
        if (v === 'boulder' || v === 'grindstone') {
            const geo = new THREE.IcosahedronGeometry(0.45, 2);
            geo.scale(1, v === 'grindstone' ? 0.32 : 0.95, v === 'grindstone' ? 0.8 : 0.55);
            jitterGeometry(geo, 0.06, hashId(e.id));
            planarUV(geo);
            k.mesh(geo, front);
            if (v === 'grindstone') k.sph(0.18, 'main', [0.05, 0.13, 0], [1.3, 0.35, 0.9]);
            return;
        }
        if (v === 'bone') {
            const geo = new THREE.CapsuleGeometry(0.16, 0.6, 4, 12);
            geo.rotateZ(Math.PI / 2); geo.scale(1, 1, 0.35);
            planarUV(geo);
            k.mesh(geo, front);
            return;
        }
        if (v === 'seal') {
            k.slab(0.5, 0.5, 0.1);
            k.box(0.14, 0.12, 0.12, 'main', [0, 0, -0.1]);
            return;
        }
        if (v === 'small') {
            k.mesh(roundedBox(0.5, 0.62, 0.12, 0.05), [front, 'main']);
            return;
        }
        k.slab(...(v === 'brick' ? [0.8, 0.5, 0.2] : [0.7, 0.9, 0.12]));
    },

    scroll(k) {
        k.cyl(0.08, 0.08, 0.7, 'main', [-0.3, 0, 0], [0, 0, 0], 18);
        k.cyl(0.07, 0.07, 0.7, 'main', [0.32, 0, 0.02], [0, 0, 0], 18);
        const sheet = k.mesh(new THREE.PlaneGeometry(0.6, 0.66, 8, 1), k.m.pattern ? 'patterned' : 'main', [0, 0, 0.06]);
        sheet.material.side = THREE.DoubleSide;
        const pos = sheet.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 5) * 0.03);
        sheet.geometry.computeVertexNormals();
    },

    panel(k, e) {
        const v = e.variant;
        if (v === 'star') {
            const pts = [];
            for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; const r = i % 2 ? 0.3 : 0.48; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
            const geo = new THREE.ExtrudeGeometry(shapeFrom(pts), { depth: 0.05, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01 });
            geo.translate(0, 0, -0.025);
            planarUV(geo);
            k.mesh(geo, ['patterned', 'main']);
            return;
        }
        if (v === 'tanga') {
            const t = new THREE.Shape();
            t.moveTo(-0.48, 0.3); t.quadraticCurveTo(0, 0.24, 0.48, 0.3);
            t.quadraticCurveTo(0.2, -0.05, 0.06, -0.42); t.lineTo(-0.06, -0.42);
            t.quadraticCurveTo(-0.2, -0.05, -0.48, 0.3);
            const geo = new THREE.ExtrudeGeometry(t, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 1, curveSegments: 10 });
            geo.translate(0, 0, -0.015);
            const pos = geo.attributes.position;
            for (let i = 0; i < pos.count; i++) { const x = pos.getX(i); pos.setZ(i, pos.getZ(i) - x * x * 0.35); }
            geo.computeVertexNormals();
            planarUV(geo);
            k.mesh(geo, ['patterned', 'main']);
            return;
        }
        if (v === 'puppet') {
            const pts = [[0, 0.62], [0.12, 0.5], [0.1, 0.3], [0.28, 0.1], [0.14, 0.06], [0.16, -0.5], [0.06, -0.62], [-0.06, -0.62], [-0.16, -0.5], [-0.14, 0.06], [-0.3, -0.2], [-0.24, -0.26], [-0.1, 0.3], [-0.12, 0.5]];
            const geo = new THREE.ExtrudeGeometry(shapeFrom(pts), { depth: 0.02, bevelEnabled: false });
            planarUV(geo);
            k.mesh(geo, ['patterned', 'main']);
            k.cyl(0.012, 0.012, 1.3, 'main', [0, -0.2, -0.03]);
            return;
        }
        const aspect = e.mat === 'parchment' ? [0.7, 0.92, 0.02] : [0.84, 0.66, 0.08];
        k.slab(...aspect);
        if (e.mat === 'wood' && e.pattern === 'icon') k.box(aspect[0] + 0.04, 0.05, 0.1, 'main', [0, aspect[1] / 2, 0]);
    },

    textile(k, e) {
        if (e.variant === 'cords') {
            k.cyl(0.025, 0.025, 0.9, 'main', [0, 0.36, 0], [0, 0, Math.PI / 2], 8);
            for (let i = 0; i < 9; i++) {
                const x = -0.38 + i * 0.095;
                k.cyl(0.012, 0.012, 0.6 + (i % 3) * 0.08, 'main', [x, 0.04 - (i % 3) * 0.04, 0], [0, 0, (i % 2 - 0.5) * 0.08], 6);
                for (let j = 0; j < 3; j++) k.sph(0.022, 'main', [x, 0.2 - j * 0.16 - (i % 2) * 0.05, 0]);
            }
            return;
        }
        const geo = new THREE.PlaneGeometry(0.9, 0.66, 18, 12);
        const pos = geo.attributes.position;
        const seed = hashId(e.id) % 100;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i), y = pos.getY(i);
            pos.setZ(i, Math.sin(x * 7 + seed) * 0.03 + Math.cos(y * 9) * 0.02);
        }
        geo.computeVertexNormals();
        const m = k.mesh(geo, k.m.pattern ? 'patterned' : 'main');
        m.material.side = THREE.DoubleSide;
    },

    crown(k, e) {
        const v = e.variant;
        if (v === 'wreath') {
            for (let i = 0; i < 34; i++) {
                const a = (i / 34) * Math.PI * 1.75 + Math.PI * 0.62;
                const leaf = k.sph(0.06, 'main', [Math.cos(a) * 0.38, 0, Math.sin(a) * 0.38], [0.5, 0.14, 1.4], 8);
                leaf.rotation.set(0.6 * (i % 2 ? 1 : -1), -a, 0.3);
            }
            k.torus(0.38, 0.015, 'main', [0, 0, 0], [Math.PI / 2, 0, 0]);
            return;
        }
        if (v === 'comb') {
            k.box(0.8, 0.12, 0.06, 'main', [0, 0, 0]);
            for (let i = 0; i < 19; i++) k.box(0.025, 0.36, 0.03, 'main', [-0.38 + i * 0.042, -0.24, 0]);
            for (let i = 0; i < 3; i++) humanoidSmall(k, -0.24 + i * 0.24, 0.06);
            for (let i = 0; i < 5; i++) k.box(0.12, 0.06, 0.06, 'main', [-0.3 + i * 0.15, 0.06, 0]);
            return;
        }
        if (v === 'feathers' || v === 'bonnet') {
            k.torus(0.3, 0.05, 'accent', [0, 0, 0], [Math.PI / 2, 0, 0]);
            const cols = v === 'bonnet' ? [0xf0ebe0, 0x2b2420] : [0xc8402e, 0x2f7d3b, 0xe3b23c, 0x2a5a9a];
            const n = v === 'bonnet' ? 22 : 16;
            for (let i = 0; i < n; i++) {
                const a = (i / n) * Math.PI * (v === 'bonnet' ? 1.2 : 2) + (v === 'bonnet' ? Math.PI * 0.9 : 0);
                const mat = makeMaterial('feather', { color: cols[i % cols.length] });
                const f = k.mesh(new THREE.SphereGeometry(0.1, 8, 6), mat, [Math.cos(a) * 0.32, 0.3, Math.sin(a) * 0.32], [0, -a, 0], [0.25, 1.6, 0.06]);
                f.rotation.z = v === 'bonnet' ? 0.5 : 0.25;
                if (v === 'bonnet') k.sph(0.03, 'dark', [Math.cos(a) * 0.4, 0.62, Math.sin(a) * 0.4]);
            }
            return;
        }
        const band = k.mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.2, 32, 1, true), 'main', [0, 0, 0]);
        band.material.side = THREE.DoubleSide;
        k.torus(0.4, 0.025, 'main', [0, -0.1, 0], [Math.PI / 2, 0, 0]);
        if (v === 'silla') {
            for (let i = 0; i < 5; i++) {
                const a = (i / 5) * Math.PI * 2;
                const x = Math.cos(a) * 0.4, z = Math.sin(a) * 0.4;
                k.box(0.06, 0.5, 0.02, 'main', [x, 0.34, z], [0, -a + Math.PI / 2, 0]);
                for (let j = 0; j < 3; j++) k.box(0.14, 0.03, 0.02, 'main', [x, 0.2 + j * 0.13, z], [0, -a + Math.PI / 2, 0]);
                k.sph(0.035, 'accent', [x * 1.05, 0.12, z * 1.05], [0.7, 1.3, 0.7]);
            }
            return;
        }
        if (v === 'chada') {
            for (let i = 0; i < 4; i++) k.cyl(0.32 - i * 0.07, 0.36 - i * 0.07, 0.16, 'main', [0, 0.16 + i * 0.16, 0], [0, 0, 0], 24);
            k.cone(0.08, 0.5, 'main', [0, 1.02, 0]);
            k.sph(0.05, 'accent', [0, 0.12, 0.4]);
            return;
        }
        const points = v === 'fleur' ? 4 : 8;
        for (let i = 0; i < points; i++) {
            const a = (i / points) * Math.PI * 2;
            const x = Math.cos(a) * 0.4, z = Math.sin(a) * 0.4;
            if (v === 'fleur') {
                k.cone(0.06, 0.26, 'main', [x, 0.22, z]);
                for (const s of [-1, 1]) k.sph(0.05, 'main', [x + Math.sin(a) * s * 0.07, 0.16, z - Math.cos(a) * s * 0.07], [0.6, 1.4, 0.6]);
            } else {
                k.cone(0.07, 0.22, 'main', [x, 0.2, z], [0, 0, 0], 4);
            }
            k.sph(0.035, 'accent', [x * 1.04, 0, z * 1.04]);
        }
    },

    jewel(k, e) {
        const v = e.variant;
        if (v === 'scarab') {
            k.sph(0.36, 'main', [0, 0.05, 0], [0.75, 0.42, 1], 20);
            k.box(0.02, 0.06, 0.62, 'dark', [0, 0.2, 0.06]);
            k.box(0.4, 0.06, 0.02, 'dark', [0, 0.18, -0.16]);
            k.sph(0.13, 'main', [0, 0.04, -0.36], [1, 0.6, 0.7]);
            k.box(0.6, 0.06, 0.8, 'main', [0, -0.08, 0]);
            return;
        }
        if (v === 'torc') {
            k.torus(0.42, 0.06, 'main', [0, 0, 0], [Math.PI / 2, 0, 0], Math.PI * 1.75);
            for (const a of [Math.PI * 1.75, 0]) k.sph(0.1, 'main', [Math.cos(a) * 0.42, 0, Math.sin(a) * 0.42]);
            return;
        }
        if (v === 'lunula') {
            const s = new THREE.Shape(); s.absarc(0, 0, 0.5, Math.PI, 0, true);
            const hole = new THREE.Path(); hole.absarc(0, 0.06, 0.34, 0, Math.PI * 2, true); s.holes.push(hole);
            k.extrude(s, 0.015, 'main', [0, 0, 0], [0, 0, 0], 0.004);
            return;
        }
        if (v === 'penannular') {
            k.torus(0.38, 0.045, 'main', [0, 0, 0], [0, 0, 0.6], Math.PI * 1.8);
            k.cyl(0.02, 0.02, 1.1, 'accent', [0, -0.1, 0.04], [0, 0, 0.1], 8);
            for (const a of [0.6, 0.6 + Math.PI * 1.8]) k.sph(0.09, 'accent', [Math.cos(a) * 0.38, Math.sin(a) * 0.38, 0], [1, 1, 0.5]);
            return;
        }
        if (v === 'ring') {
            k.torus(0.26, 0.05, 'main', [0, -0.1, 0], [0, 0, 0]);
            k.sph(0.14, 'main', [0, 0.2, 0], [1, 0.9, 0.5]);
            for (const s of [-1, 1]) k.box(0.08, 0.18, 0.06, 'main', [s * 0.14, 0.12, 0.04], [0, 0, -s * 0.6]);
            return;
        }
        if (v === 'fibula') {
            k.extrude(shapeFrom([[0, 0.5], [0.35, -0.2], [-0.35, -0.2]]), 0.03, 'main');
            k.cyl(0.03, 0.03, 0.9, 'main', [0, 0.25, -0.05], [0, 0, Math.PI / 2], 8);
            k.sph(0.08, 'accent' , [0, 0.05, 0.03]);
            return;
        }
        if (v === 'bead') {
            k.sph(0.3, 'main', [0, 0, 0], [1.2, 0.8, 0.9], 16);
            k.torus(0.08, 0.04, 'dark', [0.05, 0.1, 0.22], [0, 0, 0]);
            return;
        }
        if (v === 'earring') {
            k.torus(0.18, 0.03, 'main', [0, 0.3, 0]);
            for (let i = 0; i < 5; i++) k.mesh(new THREE.CircleGeometry(0.07, 8), 'main', [-0.18 + i * 0.09, -0.1 - (i % 2) * 0.1, 0]).material.side = THREE.DoubleSide;
            k.cyl(0.03, 0.03, 0.4, 'main', [0, 0.08, 0], [0, 0, 0], 8);
            return;
        }
        if (v === 'necklace') {
            for (let i = 0; i < 15; i++) {
                const a = Math.PI * (0.1 + i / 14 * 0.8);
                k.sph(i % 3 ? 0.04 : 0.06, i % 3 ? 'main' : 'accent', [Math.cos(a) * 0.44, -Math.sin(a) * 0.44, 0]);
            }
            k.torus(0.1, 0.03, 'main', [0, -0.56, 0], [0, 0, 0], Math.PI * 1.6);
            return;
        }
        if (v === 'frog') {
            k.sph(0.28, 'main', [0, 0, 0], [1, 0.55, 1.2], 16);
            for (const s of [-1, 1]) {
                k.sph(0.08, 'main', [s * 0.14, 0.14, -0.2]);
                k.sph(0.12, 'main', [s * 0.26, -0.06, 0.18], [0.7, 0.4, 1.3]);
            }
            return;
        }
        if (v === 'oval') {
            k.sph(0.4, 'main', [0, 0, 0], [1, 0.4, 0.66], 22);
            for (let i = 0; i < 6; i++) k.sph(0.05, 'main', [Math.cos(i) * 0.25, 0.14, Math.sin(i) * 0.15]);
            return;
        }
        if (v === 'aigrette') {
            k.sph(0.18, 'accent', [0, 0, 0], [1, 1.2, 0.5]);
            for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; k.sph(0.07, 'main', [Math.cos(a) * 0.22, Math.sin(a) * 0.26, 0]); }
            k.cyl(0.04, 0.05, 0.3, 'main', [0, 0.4, 0]);
            const plume = makeMaterial('feather', { color: 0xefe7d6 });
            k.mesh(new THREE.SphereGeometry(0.1, 8, 6), plume, [0.06, 0.78, 0], [0, 0, -0.2], [0.4, 2.4, 0.15]);
            return;
        }
        if (v === 'badge') {
            k.extrude(shapeFrom([[0, 0.42], [0.34, 0.1], [0.24, -0.38], [-0.24, -0.38], [-0.34, 0.1]]), 0.04, 'main');
            k.sph(0.1, 'main', [0, 0, 0.04], [1, 1, 0.4]);
            return;
        }
        if (v === 'pendant') {
            k.extrude(shapeFrom([[-0.38, 0.3], [0.38, 0.3], [0.22, 0.1], [0.16, -0.36], [-0.16, -0.36], [-0.22, 0.1]]), 0.06, 'main');
            k.sph(0.1, 'main', [0, 0.12, 0.05]);
            for (const s of [-1, 1]) k.sph(0.05, 'dark', [s * 0.05, 0.14, 0.13]);
            k.torus(0.06, 0.015, 'main', [0, 0.38, 0]);
            return;
        }
        if (v === 'disc') {
            k.cyl(0.42, 0.42, 0.06, 'main', [0, 0, 0], [Math.PI / 2, 0, 0], 32);
            for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; k.box(0.12, 0.06, 0.03, 'accent', [Math.cos(a) * 0.28, Math.sin(a) * 0.28, 0.04], [0, 0, a]); }
            k.sph(0.12, 'accent', [0, 0, 0.04], [1, 1, 0.4]);
            return;
        }
        // default pendant: gem in a setting on a loop
        k.torus(0.26, 0.04, 'main', [0, 0, 0]);
        k.mesh(new THREE.OctahedronGeometry(0.2, 0), e.accent ? 'accent' : 'main', [0, 0, 0], [0, 0, 0], [1, 1.2, 0.6]);
        k.torus(0.07, 0.02, 'main', [0, 0.32, 0]);
    },

    egg(k) {
        const pts = [];
        for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push([Math.sin(t * Math.PI) * 0.34 * (1 - t * 0.18), t * 0.92 - 0.46]); }
        k.lathe(pts, 'main', 32);
        for (const y of [-0.2, 0, 0.2]) k.torus(0.31 * (1 - (y + 0.46) * 0.14), 0.014, 'accent', [0, y, 0], [Math.PI / 2, 0, 0]);
        for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; k.sph(0.03, 'accent', [Math.cos(a) * 0.32, 0.1, Math.sin(a) * 0.32]); }
        k.lathe([[0, 0], [0.16, 0], [0.1, 0.08], [0.12, 0.14], [0, 0.14]], 'accent', 20, [0, -0.6, 0]);
        k.sph(0.05, 'accent', [0, 0.47, 0]);
    },

    pillar(k, e) {
        const v = e.variant;
        if (v === 'menhir') {
            const geo = new THREE.CylinderGeometry(0.2, 0.28, 1.2, 7, 3);
            jitterGeometry(geo, 0.06, hashId(e.id));
            k.mesh(geo, 'main');
            return;
        }
        if (v === 'tpillar') {
            k.box(0.26, 1.0, 0.2, 'main', [0, -0.1, 0]);
            k.box(0.72, 0.24, 0.24, 'main', [0.18, 0.5, 0]);
            for (let i = 0; i < 3; i++) k.box(0.02, 0.12, 0.22, 'dark', [0.13, 0.1 - i * 0.24, 0], [0, 0, 0.4]);
            k.sph(0.06, 'dark', [0.1, 0.3, 0.1], [1.4, 0.6, 0.4]);
            return;
        }
        if (v === 'stela') {
            k.box(0.36, 1.3, 0.2, 'main');
            for (let i = 0; i < 5; i++) {
                k.box(0.3, 0.02, 0.22, 'dark', [0, -0.4 + i * 0.22, 0]);
                for (const s of [-1, 1]) k.box(0.06, 0.08, 0.22, 'dark', [s * 0.08, -0.3 + i * 0.22, 0.002]);
            }
            k.sph(0.2, 'main', [0, 0.65, 0], [0.9, 0.5, 0.5]);
            return;
        }
        if (v === 'linga') {
            k.box(0.7, 0.18, 0.7, 'main', [0, -0.3, 0]);
            k.box(0.3, 0.06, 0.12, 'main', [0.4, -0.26, 0]);
            k.cyl(0.14, 0.14, 0.4, 'main', [0, 0, 0], [0, 0, 0], 16);
            k.sph(0.14, 'main', [0, 0.2, 0]);
            return;
        }
        k.cyl(0.2, 0.22, 0.9, 'main', [0, -0.15, 0], [0, 0, 0], 20);
        for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; k.box(0.02, 0.88, 0.02, 'dark', [Math.cos(a) * 0.205, -0.15, Math.sin(a) * 0.205]); }
        k.box(0.62, 0.08, 0.36, 'main', [0, 0.36, 0]);
        if (v === 'ionic') for (const s of [-1, 1]) k.torus(0.08, 0.035, 'main', [s * 0.3, 0.3, 0], [0, 0, 0], Math.PI * 1.7);
        k.box(0.5, 0.06, 0.5, 'main', [0, -0.62, 0]);
    },

    animal(k, e) {
        const v = e.variant;
        const m = k.m.pattern ? 'patterned' : 'main';
        k.box(0.9, 0.06, 0.36, 'main', [0, -0.08, 0]);
        if (v === 'cat') {
            k.sph(0.22, m, [0, 0.26, 0], [0.8, 1.3, 0.9]);
            k.sph(0.15, m, [0, 0.62, 0.04]);
            for (const s of [-1, 1]) k.cone(0.05, 0.12, m, [s * 0.08, 0.78, 0.02], [0, 0, 0], 4);
            k.cyl(0.03, 0.03, 0.4, m, [0.18, 0.06, -0.12], [0.2, 0, 1.2]);
            if (e.mat === 'ceramic') k.cyl(0.045, 0.045, 0.24, m, [0.17, 0.66, 0.06], [0, 0, 0.3]);
            return;
        }
        if (v === 'sphinx' || v === 'lion' && e.mat === 'limestone') {
            k.box(0.7, 0.22, 0.3, m, [-0.06, 0.08, 0]);
            for (const s of [-1, 1]) k.box(0.3, 0.08, 0.08, m, [0.38, 0.0, s * 0.1]);
            k.sph(0.13, m, [0.24, 0.36, 0]);
            k.box(0.18, 0.28, 0.32, k.m.pattern ? 'patterned' : 'main', [0.22, 0.32, 0]);
            return;
        }
        const longNeck = v === 'llama' || v === 'horse' || v === 'griffin';
        const bodyMat = m;
        k.sph(0.24, bodyMat, [0, 0.36, 0], [1.5, 0.85, 0.85]);
        for (const [x, z] of [[-0.24, -0.1], [-0.24, 0.1], [0.24, -0.1], [0.24, 0.1]]) k.cyl(0.05, 0.04, 0.3, bodyMat, [x, 0.08, z]);
        const neckY = longNeck ? 0.64 : 0.48;
        k.cyl(0.07, 0.1, longNeck ? 0.36 : 0.18, bodyMat, [0.34, neckY - 0.06, 0], [0, 0, longNeck ? -0.35 : -0.8]);
        const head = k.sph(v === 'elephant' ? 0.18 : 0.12, bodyMat, [0.42, neckY + 0.1, 0], v === 'horse' || v === 'llama' ? [1.3, 0.8, 0.8] : [1, 1, 1]);
        k.cyl(0.02, 0.03, 0.26, bodyMat, [-0.42, 0.42, 0], [0, 0, 0.9]);
        if (v === 'bull' || v === 'lamassu') for (const s of [-1, 1]) k.cone(0.03, 0.16, 'main', [0.46, neckY + 0.2, s * 0.08], [s * 0.6, 0, -0.4], 6);
        if (v === 'llama') for (const s of [-1, 1]) k.cone(0.03, 0.1, 'main', [0.4, neckY + 0.2, s * 0.05], [0, 0, 0], 4);
        if (v === 'elephant') {
            k.cyl(0.05, 0.03, 0.34, bodyMat, [0.56, neckY - 0.08, 0], [0, 0, 0.3]);
            for (const s of [-1, 1]) k.sph(0.14, bodyMat, [0.36, neckY + 0.08, s * 0.16], [0.4, 1, 1]);
        }
        if (v === 'lamassu' || v === 'griffin') {
            for (const s of [-1, 1]) k.box(0.5, 0.28, 0.02, 'main', [-0.06, 0.62, s * 0.16], [s * 0.4, 0, 0.3]);
            if (v === 'griffin') k.cone(0.04, 0.12, 'main', [0.54, neckY + 0.08, 0], [0, 0, -Math.PI / 2], 6);
            if (v === 'lamassu') k.box(0.14, 0.18, 0.18, 'main', [0.44, neckY + 0.22, 0]);
        }
        if (v === 'lion' || v === 'leopard') k.sph(0.17, bodyMat, [0.4, neckY + 0.08, 0], [0.8, 1.1, 1.1]);
        head.updateMatrix();
    },

    bird(k, e) {
        const v = e.variant;
        k.cyl(0.24, 0.28, 0.08, 'main', [0, -0.04, 0], [0, 0, 0], 18);
        if (v === 'owl') {
            k.sph(0.26, 'main', [0, 0.3, 0], [0.9, 1.15, 0.85]);
            k.sph(0.2, 'main', [0, 0.66, 0], [1.1, 0.95, 0.9]);
            for (const s of [-1, 1]) { k.sph(0.07, 'dark', [s * 0.09, 0.68, 0.16]); k.cone(0.04, 0.1, 'main', [s * 0.12, 0.84, 0], [0, 0, 0], 4); }
            k.cone(0.03, 0.08, 'dark', [0, 0.6, 0.2], [Math.PI / 2 + 0.3, 0, 0], 4);
            return;
        }
        k.sph(0.22, 'main', [0, 0.34, 0], [0.9, 1.3, 0.8]);
        k.sph(0.12, 'main', [0, 0.72, 0.04]);
        k.cone(0.04, 0.14, 'accent', [0, 0.7, 0.18], [Math.PI / 2, 0, 0], 6);
        for (const s of [-1, 1]) k.box(0.5, 0.36, 0.03, 'main', [s * 0.36, 0.5, -0.04], [0, s * 0.25, s * -0.4]);
    },

    instrument(k, e) {
        const v = e.variant;
        if (v === 'lyre' || v === 'bull-lyre') {
            if (v === 'bull-lyre') {
                k.box(0.6, 0.36, 0.2, 'main', [0, -0.2, 0]);
                k.box(0.07, 0.8, 0.07, 'main', [-0.26, 0.38, 0]);
                k.box(0.07, 0.6, 0.07, 'main', [0.26, 0.28, 0]);
                k.box(0.66, 0.06, 0.07, 'main', [0, 0.72, 0], [0, 0, 0.25]);
                k.sph(0.12, 'accent', [-0.34, 0.12, 0.12], [1, 1.2, 0.9]);
                k.box(0.12, 0.16, 0.06, makeMaterial('lapis'), [-0.34, -0.02, 0.16]);
            } else {
                k.sph(0.24, 'accent', [0, -0.26, 0], [1.2, 0.8, 0.5]);
                for (const s of [-1, 1]) k.cyl(0.03, 0.04, 0.8, 'main', [s * 0.2, 0.18, 0], [0, 0, s * -0.22], 8);
                k.box(0.62, 0.05, 0.05, 'main', [0, 0.54, 0]);
            }
            for (let i = 0; i < 6; i++) k.cyl(0.004, 0.004, 0.7, 'dark', [-0.12 + i * 0.05, 0.16, 0.04], [0, 0, 0], 4);
            return;
        }
        if (v === 'zither') {
            k.box(1.2, 0.1, 0.28, 'main');
            for (let i = 0; i < 12; i++) k.cyl(0.004, 0.004, 1.1, 'dark', [0, 0.06, -0.12 + i * 0.022], [0, 0, Math.PI / 2], 4);
            return;
        }
        if (v === 'panpipe') {
            for (let i = 0; i < 7; i++) {
                const len = 0.9 - i * 0.09, x = -0.33 + i * 0.11;
                k.cyl(0.055, 0.055, len, k.m.pattern ? 'patterned' : 'main', [x, 0.45 - len / 2, 0], [0, 0, 0], 12);
                k.cyl(0.03, 0.03, 0.01, 'dark', [x, 0.455, 0], [0, 0, 0], 8);
            }
            k.box(0.82, 0.08, 0.14, 'main', [0, 0.28, 0]);
            return;
        }
        if (v === 'castanets') {
            for (const s of [-1, 1]) k.sph(0.24, 'main', [s * 0.14, 0, 0], [1, 1.15, 0.35]);
            k.torus(0.06, 0.015, 'dark', [0, 0.3, 0]);
            return;
        }
        // lute / sitar / shamisen
        const sitar = v === 'sitar';
        k.sph(sitar ? 0.26 : 0.22, 'main', [0, -0.36, 0], sitar ? [1, 1, 0.8] : [1, 1, 0.35]);
        k.box(0.08, 1.1, 0.05, 'main', [0, 0.32, 0]);
        k.box(0.12, 0.16, 0.06, 'main', [0, 0.92, 0]);
        for (let i = 0; i < 3; i++) k.cyl(0.003, 0.003, 1.2, 'dark', [-0.02 + i * 0.02, 0.24, 0.04], [0, 0, 0], 4);
        if (sitar) k.sph(0.12, 'main', [0, 0.7, -0.08]);
    },

    horn(k, e) {
        const v = e.variant;
        if (v === 'lur') {
            const curve = new THREE.CatmullRomCurve3([
                new THREE.Vector3(-0.5, -0.4, 0), new THREE.Vector3(-0.2, 0.1, 0), new THREE.Vector3(0.3, 0.2, 0), new THREE.Vector3(0.5, 0.55, 0),
            ]);
            k.mesh(new THREE.TubeGeometry(curve, 40, 0.035, 10), 'main');
            k.cyl(0.18, 0.18, 0.02, 'main', [0.5, 0.58, 0], [0, 0, -0.3], 24);
            return;
        }
        const pts = [];
        for (let i = 0; i <= 12; i++) {
            const t = i / 12;
            pts.push(new THREE.Vector3(Math.sin(t * 1.6) * 0.5 - 0.3, t * 0.9 - 0.45, 0));
        }
        const curve = new THREE.CatmullRomCurve3(pts);
        const geo = new THREE.TubeGeometry(curve, 30, 0.12, 14);
        const pos = geo.attributes.position;
        // taper the tube toward the tip
        for (let i = 0; i < pos.count; i++) {
            const seg = Math.floor(i / 15) / 30;
            const c = curve.getPointAt(Math.min(1, seg));
            const k2 = 0.25 + seg * 0.75;
            pos.setXYZ(i, c.x + (pos.getX(i) - c.x) * k2, c.y + (pos.getY(i) - c.y) * k2, c.z + (pos.getZ(i) - c.z) * k2);
        }
        geo.computeVertexNormals();
        k.mesh(geo, 'main');
        const end = curve.getPointAt(1);
        if (v === 'rhyton') {
            k.sph(0.16, 'main', [end.x + 0.02, end.y + 0.02, 0]);
            for (const s of [-1, 1]) k.cone(0.03, 0.14, 'main', [end.x + 0.08, end.y + 0.16, s * 0.06], [0, 0, -0.5], 6);
        } else {
            k.torus(0.12, 0.02, 'accent', [end.x, end.y, 0], [Math.PI / 2, 0, -0.5]);
        }
        const start = curve.getPointAt(0);
        k.sph(0.04, 'accent', [start.x, start.y, 0]);
    },

    chalice(k, e) {
        const v = e.variant;
        if (v === 'cup') {
            k.lathe([[0, 0], [0.18, 0], [0.2, 0.03], [0.28, 0.3], [0.3, 0.4], [0.28, 0.4], [0.24, 0.1], [0, 0.06]], k.m.pattern ? 'patterned' : 'main', 32);
            k.torus(0.1, 0.025, 'main', [0.32, 0.2, 0], [0, 0, 0], Math.PI * 1.2);
            k.cyl(0.36, 0.36, 0.02, 'main', [0, -0.02, 0], [0, 0, 0], 32);
            return;
        }
        k.lathe([[0, 0], [0.26, 0], [0.26, 0.04], [0.1, 0.1], [0.05, 0.16], [0.05, 0.42], [0.14, 0.48], [0.3, 0.62], [0.34, 0.86], [0.32, 0.86], [0.28, 0.64], [0.12, 0.52], [0, 0.5]], 'main', 32);
        k.torus(0.32, 0.015, 'accent', [0, 0.78, 0], [Math.PI / 2, 0, 0]);
        if (v === 'twohandle') for (const s of [-1, 1]) k.torus(0.1, 0.02, 'main', [s * 0.36, 0.64, 0], [0, 0, s * 0.5], Math.PI * 1.2);
        k.sph(0.06, 'accent', [0, 0.3, 0]);
    },

    bell(k, e) {
        const v = e.variant;
        const prof = v === 'korean'
            ? [[0, 0.9], [0.24, 0.9], [0.3, 0.8], [0.32, 0.2], [0.38, 0], [0.36, 0], [0.3, 0.2], [0.28, 0.8], [0, 0.86]]
            : [[0, 0.8], [0.18, 0.8], [0.24, 0.6], [0.3, 0.2], [0.4, 0], [0.38, 0], [0.28, 0.2], [0.22, 0.6], [0, 0.76]];
        const m = k.lathe(prof, 'main', 30);
        m.material.side = THREE.DoubleSide;
        if (v === 'zhong') {
            m.scale.set(1, 1, 0.72);
            for (let i = 0; i < 9; i++) k.sph(0.035, 'main', [-0.12 + (i % 3) * 0.12, 0.3 + Math.floor(i / 3) * 0.14, 0.22]);
            k.cyl(0.05, 0.06, 0.34, 'main', [0, 0.96, 0]);
        } else if (v === 'ghanta') {
            k.cyl(0.04, 0.05, 0.36, 'main', [0, 0.96, 0]);
            k.sph(0.08, 'main', [0, 1.16, 0]);
        } else {
            k.torus(0.12, 0.04, 'main', [0, 0.98, 0], [0, 0, 0], Math.PI);
            for (let i = 0; i < 4; i++) k.torus(0.31, 0.012, 'main', [0, 0.25 + i * 0.12, 0], [Math.PI / 2, 0, 0]);
        }
    },

    totem(k, e) {
        const v = e.variant;
        const m = k.m.pattern ? 'patterned' : 'main';
        if (v === 'doll') {
            k.lathe([[0, 0], [0.28, 0], [0.32, 0.2], [0.26, 0.5], [0.18, 0.6], [0.22, 0.74], [0.18, 0.9], [0, 0.94]], 'main', 28);
            k.sph(0.15, makeMaterial('ivory', { color: 0xf3dcc2 }), [0, 0.74, 0.12], [1, 1, 0.4]);
            k.sph(0.12, 'accent', [0, 0.3, 0.26], [1.2, 1, 0.3]);
            return;
        }
        if (v === 'hand') {
            const pts = [[-0.3, -0.5], [0.3, -0.5], [0.32, 0.1], [0.42, 0.3], [0.3, 0.32], [0.24, 0.16], [0.22, 0.56], [0.12, 0.56], [0.1, 0.16], [0.06, 0.62], [-0.04, 0.62], [-0.06, 0.16], [-0.1, 0.56], [-0.2, 0.56], [-0.22, 0.16], [-0.3, 0.3], [-0.42, 0.28], [-0.32, 0.1]];
            k.extrude(shapeFrom(pts), 0.05, 'main');
            k.sph(0.1, 'dark', [0, -0.14, 0.04], [1.4, 0.8, 0.4]);
            return;
        }
        if (v === 'standard') {
            k.cyl(0.03, 0.03, 0.6, 'main', [0, -0.3, 0]);
            k.torus(0.4, 0.03, 'main', [0, 0.36, 0]);
            for (let i = 0; i < 4; i++) k.box(0.8, 0.025, 0.025, 'main', [0, 0.36, 0], [0, 0, i * Math.PI / 4]);
            for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; k.torus(0.05, 0.012, 'main', [Math.cos(a) * 0.42, 0.36 + Math.sin(a) * 0.42, 0]); }
            k.sph(0.08, 'main', [0, 0.84, 0]);
            return;
        }
        if (v === 'serpent') {
            k.torus(0.3, 0.1, m, [0, 0, 0], [Math.PI / 2, 0, 0], Math.PI * 1.6);
            k.sph(0.18, m, [0.3, 0.12, 0], [1.4, 0.9, 1]);
            for (const s of [-1, 1]) k.sph(0.04, 'dark', [0.42, 0.22, s * 0.1]);
            k.box(0.2, 0.03, 0.14, 'dark', [0.48, 0.04, 0]);
            return;
        }
        if (v === 'dogu') {
            k.sph(0.24, m, [0, 0.2, 0], [1.1, 1.3, 0.8]);
            k.sph(0.18, m, [0, 0.6, 0]);
            for (const s of [-1, 1]) {
                k.sph(0.08, m, [s * 0.08, 0.62, 0.13], [1.4, 0.6, 0.5]);
                k.box(0.12, 0.012, 0.02, 'dark', [s * 0.08, 0.62, 0.17]);
                k.cyl(0.07, 0.06, 0.3, m, [s * 0.28, 0.28, 0], [0, 0, s * 0.6]);
                k.cyl(0.08, 0.1, 0.24, m, [s * 0.12, -0.16, 0]);
            }
            return;
        }
        if (v === 'finial') {
            k.cyl(0.05, 0.08, 0.5, 'main', [0, -0.2, 0]);
            for (const s of [-1, 1]) {
                k.sph(0.12, 'main', [s * 0.18, 0.2, 0], [0.6, 1.4, 0.6]);
                k.cone(0.05, 0.2, 'main', [s * 0.18, 0.46, 0], [0, 0, s * 0.3]);
            }
            k.sph(0.1, 'main', [0, 0.2, 0]);
            return;
        }
        if (v === 'urnfigure' || v === 'figurine') {
            humanoid(k, { robe: m, seated: v === 'urnfigure' });
            return;
        }
        // pole: stacked faces
        for (let i = 0; i < 3; i++) {
            const y = i * 0.36;
            k.cyl(0.18, 0.2, 0.36, m, [0, y, 0], [0, 0, 0], 16);
            for (const s of [-1, 1]) k.sph(0.05, 'dark', [s * 0.07, y + 0.06, 0.17]);
            k.box(0.12, 0.04, 0.06, 'accent', [0, y - 0.08, 0.18]);
        }
        k.box(0.7, 0.08, 0.12, 'main', [0, 0.92, 0]);
    },

    cross(k, e) {
        const v = e.variant;
        if (v === 'ankh') {
            k.torus(0.16, 0.05, 'main', [0, 0.36, 0], [0, 0, 0], Math.PI * 2, [0.8, 1.15, 1]);
            k.box(0.5, 0.1, 0.08, 'main', [0, 0.12, 0]);
            k.box(0.1, 0.62, 0.08, 'main', [0, -0.24, 0]);
            return;
        }
        if (v === 'ethiopian') {
            k.box(0.08, 0.5, 0.04, 'main', [0, -0.52, 0]);
            for (let i = 0; i < 4; i++) {
                const a = i * Math.PI / 2;
                k.torus(0.16, 0.025, 'main', [Math.cos(a) * 0.22, 0.2 + Math.sin(a) * 0.22, 0]);
                k.sph(0.04, 'main', [Math.cos(a) * 0.42, 0.2 + Math.sin(a) * 0.42, 0]);
            }
            k.torus(0.08, 0.025, 'main', [0, 0.2, 0]);
            return;
        }
        k.box(0.22, 1.1, 0.14, 'main', [0, -0.05, 0]);
        k.box(0.7, 0.2, 0.14, 'main', [0, 0.22, 0]);
        if (v === 'celtic') k.torus(0.24, 0.035, 'main', [0, 0.22, 0]);
        k.box(0.4, 0.14, 0.24, 'main', [0, -0.6, 0]);
    },

    temple(k, e) {
        const v = e.variant;
        if (v === 'spirit') {
            k.cyl(0.05, 0.05, 0.5, 'main', [0, -0.3, 0]);
            k.box(0.5, 0.06, 0.5, 'main', [0, 0, 0]);
            k.box(0.36, 0.3, 0.36, 'main', [0, 0.18, 0]);
            k.mesh(new THREE.ConeGeometry(0.34, 0.34, 4), 'accent', [0, 0.5, 0], [0, Math.PI / 4, 0]);
            k.cone(0.03, 0.22, 'accent', [0, 0.76, 0]);
            return;
        }
        if (v === 'prasat') {
            for (let i = 0; i < 5; i++) k.box(0.7 - i * 0.12, 0.14, 0.7 - i * 0.12, 'main', [0, -0.3 + i * 0.14, 0]);
            k.cone(0.16, 0.5, 'main', [0, 0.65, 0], [0, 0, 0], 8);
            k.box(0.6, 0.3, 0.06, 'main', [0, -0.05, 0.38]);
            return;
        }
        if (v === 'cross') {
            k.box(0.9, 0.36, 0.3, 'main');
            k.box(0.3, 0.36, 0.9, 'main');
            k.box(1.1, 0.06, 1.1, 'dark', [0, -0.21, 0]);
            for (const s of [-1, 1]) k.box(0.06, 0.12, 0.04, 'dark', [s * 0.3, 0, 0.16]);
            return;
        }
        k.box(0.9, 0.08, 0.6, 'main', [0, -0.3, 0]);
        k.box(0.8, 0.06, 0.5, 'main', [0, -0.23, 0]);
        for (let i = 0; i < 5; i++) for (const z of [-0.18, 0.18]) k.cyl(0.035, 0.04, 0.42, 'main', [-0.32 + i * 0.16, 0, z], [0, 0, 0], 10);
        k.box(0.82, 0.06, 0.52, 'main', [0, 0.24, 0]);
        const roof = new THREE.Shape(); roof.moveTo(-0.44, 0); roof.lineTo(0.44, 0); roof.lineTo(0, 0.2); roof.closePath();
        k.extrude(roof, 0.5, 'main', [0, 0.27, 0], [0, 0, 0], 0.005);
    },

    drum(k, e) {
        if (e.variant === 'hourglass') {
            k.lathe([[0, -0.5], [0.24, -0.5], [0.1, 0], [0.24, 0.5], [0, 0.5]], 'main', 24);
            for (const y of [-0.5, 0.5]) k.cyl(0.25, 0.25, 0.02, makeMaterial('leather', { color: 0xd8c3a0 }), [0, y, 0], [0, 0, 0], 24);
            for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; k.cyl(0.006, 0.006, 1.0, 'dark', [Math.cos(a) * 0.17, 0, Math.sin(a) * 0.17], [0, 0, 0], 3); }
            return;
        }
        k.cyl(0.36, 0.32, 0.5, 'main', [0, 0, 0], [0, 0, 0], 26);
        k.cyl(0.37, 0.37, 0.02, makeMaterial('leather', { color: 0xd8c3a0 }), [0, 0.26, 0], [0, 0, 0], 26);
    },

    boat(k, e) {
        const v = e.variant;
        const hull = k.mesh(new THREE.SphereGeometry(0.5, 22, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 'main', [0, 0.08, 0], [0, 0, 0], [1.4, 0.4, 0.42]);
        hull.material.side = THREE.DoubleSide;
        if (v === 'raft') {
            hull.scale.set(1.4, 0.14, 0.6);
            humanoidSmall(k, 0, 0.12, 1.4);
            for (let i = 0; i < 6; i++) humanoidSmall(k, -0.45 + (i % 3) * 0.12 + (i > 2 ? 0.66 : 0), 0.1, 0.8);
            return;
        }
        if (v === 'turtle') {
            k.sph(0.4, 'main', [0, 0.1, 0], [1.4, 0.45, 0.6]);
            for (let i = 0; i < 12; i++) k.cone(0.02, 0.07, 'dark', [-0.4 + (i % 6) * 0.16, 0.28, i < 6 ? -0.08 : 0.08], [0, 0, 0], 4);
            k.sph(0.09, 'main', [0.68, 0.12, 0], [1.3, 1, 0.9]);
            return;
        }
        if (v === 'longship') {
            const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0.62, 0.08, 0), new THREE.Vector3(0.78, 0.3, 0), new THREE.Vector3(0.7, 0.5, 0), new THREE.Vector3(0.6, 0.46, 0)]);
            k.mesh(new THREE.TubeGeometry(curve, 20, 0.03, 8), 'main');
            const c2 = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.62, 0.08, 0), new THREE.Vector3(-0.78, 0.32, 0), new THREE.Vector3(-0.66, 0.44, 0)]);
            k.mesh(new THREE.TubeGeometry(c2, 20, 0.03, 8), 'main');
            for (let i = 0; i < 6; i++) k.cyl(0.05, 0.05, 0.02, 'accent', [-0.4 + i * 0.16, 0.12, 0.2], [Math.PI / 2, 0, 0], 12);
            return;
        }
        const masts = v === 'ship' ? 3 : 1;
        for (let i = 0; i < masts; i++) {
            const x = masts === 1 ? 0 : -0.3 + i * 0.3;
            k.cyl(0.014, 0.014, 0.7, 'dark', [x, 0.42, 0]);
            const sail = k.mesh(new THREE.PlaneGeometry(0.22, 0.3, 4, 2), makeMaterial('textile', { color: 0xe8ddc4, side: THREE.DoubleSide }), [x + 0.02, 0.48, 0], [0, Math.PI / 2, 0]);
            sail.material.side = THREE.DoubleSide;
        }
        k.box(0.4, 0.14, 0.24, 'main', [-0.5, 0.16, 0]);
    },

    seal(k, e) {
        if (e.variant === 'type') {
            k.box(0.2, 0.7, 0.24, 'main', [0, 0, 0]);
            k.box(0.14, 0.04, 0.16, 'main', [0, 0.37, 0]);
            k.box(0.06, 0.06, 0.04, 'dark', [0.04, 0.39, 0.02]);
            return;
        }
        if (e.variant === 'weight') {
            k.sph(0.3, 'main', [0, 0, 0], [1, 0.8, 1], 18);
            for (const s of [-1, 1]) k.cyl(0.14, 0.14, 0.02, 'main', [0, s * 0.24, 0], [0, 0, 0], 18);
            return;
        }
        k.cyl(0.18, 0.18, 0.62, 'main', [0, 0, 0], [0, 0, 0], 24);
        for (let i = 0; i < 6; i++) k.box(0.02, 0.4, 0.02, 'dark', [Math.cos(i) * 0.18, 0, Math.sin(i) * 0.18], [0, -i, 0.2]);
        k.cyl(0.03, 0.03, 0.66, 'dark', [0, 0, 0], [0, 0, 0], 8);
    },

    pipe(k) {
        k.lathe([[0, 0], [0.08, 0], [0.1, 0.06], [0.11, 0.2], [0.09, 0.24], [0.08, 0.24], [0.06, 0.06], [0, 0.04]], 'main', 18, [0.5, -0.06, 0]);
        k.cyl(0.025, 0.03, 1.0, 'main', [0, -0.06, 0], [0, 0, Math.PI / 2 + 0.06], 10);
    },

    tube(k, e) {
        if (e.variant === 'stick') {
            k.box(0.08, 0.9, 0.04, 'main');
            for (let i = 0; i < 10; i++) k.box(0.09, 0.012, 0.045, 'dark', [0, -0.38 + i * 0.08, 0]);
            return;
        }
        const geo = new THREE.CylinderGeometry(0.07, 0.1, 1.3, 14, 6);
        jitterGeometry(geo, 0.012, hashId(e.id));
        k.mesh(geo, k.m.pattern ? 'patterned' : 'main');
    },

    boomerang(k) {
        const s = new THREE.Shape();
        s.moveTo(-0.5, -0.1);
        s.quadraticCurveTo(0, 0.5, 0.5, -0.1);
        s.lineTo(0.42, -0.2);
        s.quadraticCurveTo(0, 0.28, -0.42, -0.2);
        s.closePath();
        k.extrude(s, 0.03, 'main', [0, 0, 0], [0, 0, 0], 0.01);
    },

    lamp(k, e) {
        const face = k.m.pattern ? 'patterned' : 'main';
        if (e.variant === 'diya') {
            // open saucer pinched into a spout for the wick
            const bowl = k.lathe([[0, 0], [0.2, 0], [0.3, 0.06], [0.36, 0.16], [0.34, 0.17], [0.27, 0.08], [0, 0.05]], face, 28);
            bowl.scale.set(1, 1, 0.82);
            k.cone(0.07, 0.18, 'main', [0.38, 0.12, 0], [0, 0, -Math.PI / 2 - 0.25], 10);
            return;
        }
        // closed mould-made lamp: round body, sunken discus, nozzle and ring handle
        k.lathe([[0, 0], [0.22, 0], [0.3, 0.06], [0.31, 0.12], [0.26, 0.18], [0.12, 0.2], [0, 0.17]], face, 30);
        k.torus(0.12, 0.018, 'main', [0, 0.19, 0], [Math.PI / 2, 0, 0]);
        k.sph(0.035, 'dark', [0, 0.18, 0], [1, 0.3, 1]);
        k.cyl(0.07, 0.09, 0.26, 'main', [0.36, 0.08, 0], [0, 0, Math.PI / 2], 14);
        k.cyl(0.035, 0.035, 0.02, 'dark', [0.44, 0.155, 0], [0, 0, 0], 10);
        k.torus(0.06, 0.022, 'main', [-0.33, 0.12, 0]);
    },

    sherd(k, e) {
        // an irregular, curved piece of a vessel wall
        let s = hashId(e.id) || 1;
        const r = () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) >>> 0) / 4294967296);
        const n = 14;
        const pts = [];
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + (r() - 0.5) * 0.3;
            const rad = 0.28 + r() * 0.18;
            pts.push([Math.cos(a) * rad * 1.15, Math.sin(a) * rad]);
        }
        const geo = new THREE.ExtrudeGeometry(shapeFrom(pts), { depth: 0.05, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1, curveSegments: 4 });
        geo.translate(0, 0, -0.025);
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) { const x = pos.getX(i); pos.setZ(i, pos.getZ(i) - x * x * 0.6); }
        geo.computeVertexNormals();
        planarUV(geo);
        k.mesh(geo, [k.m.pattern ? 'patterned' : 'main', 'main']);
    },

    whorl(k, e) {
        const face = k.m.pattern ? 'patterned' : 'main';
        if (e.variant === 'loomweight') {
            const geo = new THREE.CylinderGeometry(0.14, 0.26, 0.6, 4, 1);
            geo.rotateY(Math.PI / 4);
            const m = k.mesh(geo, face);
            m.material.flatShading = true;
            k.cyl(0.04, 0.04, 0.24, 'dark', [0, 0.18, 0], [Math.PI / 2, 0, 0], 12);
            return;
        }
        // biconical whorl with a spindle hole
        k.lathe([[0, -0.12], [0.16, -0.11], [0.3, -0.01], [0.3, 0.01], [0.16, 0.11], [0, 0.12]], face, 28, [0, 0, 0], [0.5, 0, 0]);
        k.cyl(0.05, 0.05, 0.25, 'dark', [0, 0, 0], [0.5, 0, 0], 14);
    },

    key(k, e) {
        if (e.variant === 'spoon') {
            k.sph(0.16, 'main', [0, -0.3, 0], [1, 1.4, 0.35]);
            k.box(0.05, 0.62, 0.025, 'main', [0, 0.14, 0.02]);
            k.sph(0.045, 'main', [0, 0.46, 0.02]);
            return;
        }
        k.torus(0.13, 0.035, 'main', [0, 0.36, 0]);
        k.cyl(0.035, 0.035, 0.62, 'main', [0, -0.02, 0], [0, 0, 0], 12);
        k.box(0.16, 0.12, 0.03, 'main', [0.09, -0.26, 0]);
        k.box(0.04, 0.05, 0.035, 'dark', [0.12, -0.27, 0]);
    },

    buckle(k) {
        k.torus(0.26, 0.04, 'main', [0, 0.1, 0], [0, 0, 0], Math.PI * 2, [1.2, 1, 1]);
        k.cyl(0.02, 0.016, 0.5, 'main', [0, 0.1, 0.04], [0, 0, 0], 8);
        k.box(0.5, 0.34, 0.03, 'main', [0, -0.34, -0.01]);
        for (const s of [-1, 1]) k.sph(0.03, 'main', [s * 0.17, -0.4, 0.01]);
    },

    pin(k, e) {
        const v = e.variant;
        if (v === 'needle') {
            k.cyl(0.012, 0.004, 1.0, 'main', [0, 0, 0], [0, 0, 0], 8);
            k.torus(0.022, 0.008, 'main', [0, 0.5, 0]);
            return;
        }
        k.cyl(0.018, 0.006, 1.1, 'main', [0, -0.05, 0], [0, 0, 0], 8);
        if (v === 'tupu') {
            const fan = new THREE.Shape();
            fan.moveTo(0, 0); fan.absarc(0, 0, 0.26, 0, Math.PI, false); fan.closePath();
            k.extrude(fan, 0.02, 'main', [0, 0.48, 0], [0, 0, 0], 0.004);
            k.cyl(0.03, 0.03, 0.03, 'dark', [0, 0.58, 0], [Math.PI / 2, 0, 0], 10);
            return;
        }
        k.sph(0.07, e.accent ? 'accent' : 'main', [0, 0.54, 0]);
        k.torus(0.03, 0.012, 'main', [0, 0.44, 0], [Math.PI / 2, 0, 0]);
    },

    mirror(k, e) {
        const v = e.variant;
        k.cyl(0.4, 0.4, 0.04, 'main', [0, 0, 0], [Math.PI / 2, 0, 0], 40);
        k.torus(0.4, 0.03, 'main');
        if (v === 'knob') {
            // decorated back with a central pierced knob for a cord
            k.sph(0.08, 'main', [0, 0, -0.04], [1, 1, 0.6]);
            for (let i = 0; i < 3; i++) k.torus(0.14 + i * 0.08, 0.012, 'main', [0, 0, -0.025]);
            return;
        }
        if (v === 'plain') return;
        k.cyl(0.04, 0.05, 0.42, 'main', [0, -0.6, 0], [0, 0, 0], 12);
        k.sph(0.06, 'main', [0, -0.83, 0]);
    },

    bangle(k) {
        k.torus(0.36, 0.055, k.m.pattern ? 'patterned' : 'main', [0, 0, 0], [Math.PI / 2.4, 0, 0]);
    },

    ball(k, e) {
        const v = e.variant;
        if (v === 'sling') {
            const pts = [];
            for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push([Math.sin(t * Math.PI) * 0.2 + 0.001, (t - 0.5) * 0.7]); }
            k.lathe(pts, 'main', 16, [0, 0, 0], [0, 0, Math.PI / 2]);
            return;
        }
        if (v === 'lump') {
            const geo = new THREE.IcosahedronGeometry(0.36, 1);
            geo.scale(1, 0.7, 0.85);
            jitterGeometry(geo, 0.12, hashId(e.id));
            k.mesh(geo, 'main').material.flatShading = true;
            return;
        }
        if (v === 'crystal') {
            k.cyl(0.18, 0.2, 0.6, 'main', [0, 0, 0], [0, 0, 0], 6).material.flatShading = true;
            k.cone(0.18, 0.18, 'main', [0, 0.39, 0], [0, 0, 0], 6);
            k.cyl(0.09, 0.1, 0.32, 'main', [0.2, -0.1, 0.05], [0, 0, -0.5], 6);
            return;
        }
        if (v === 'shell') {
            // conch: spire on top, body whorl and a dark aperture
            k.lathe([[0, -0.45], [0.12, -0.3], [0.3, 0.05], [0.32, 0.18], [0.2, 0.28], [0.08, 0.42], [0, 0.48]], 'main', 24);
            for (let i = 0; i < 3; i++) k.torus(0.26 - i * 0.07, 0.025, 'main', [0, 0.16 + i * 0.1, 0], [Math.PI / 2, 0, 0]);
            k.sph(0.16, 'dark', [0.16, -0.05, 0.14], [0.6, 1.6, 0.4]);
            return;
        }
        k.sph(0.3, 'main', [0, 0, 0], [1, 1, 1], 20);
        k.cyl(0.05, 0.06, 0.06, 'main', [0, 0.3, 0], [0, 0, 0], 10);
    },
};

function humanoidSmall(k, x, y, scale = 1) {
    k.cyl(0.03 * scale, 0.04 * scale, 0.14 * scale, 'main', [x, y + 0.07 * scale, 0]);
    k.sph(0.03 * scale, 'main', [x, y + 0.17 * scale, 0]);
}

function planarUV(geo) {
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    const pos = geo.attributes.position;
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
        uv[i * 2] = (pos.getX(i) - bb.min.x) / (bb.max.x - bb.min.x || 1);
        uv[i * 2 + 1] = (pos.getY(i) - bb.min.y) / (bb.max.y - bb.min.y || 1);
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

function roundedBox(w, h, d, r) {
    const s = new THREE.Shape();
    s.moveTo(-w / 2 + r, -h / 2);
    s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    const geo = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: r, bevelSize: r * 0.6, bevelSegments: 3 });
    geo.translate(0, 0, -d / 2);
    planarUV(geo);
    return geo;
}

/**
 * Build a normalised model for a catalog entry.
 * @returns THREE.Group with userData { materials, entry, size }
 */
export function buildArtifact(entry, { envMap = null, target = TARGET_SIZE } = {}) {
    const inner = new THREE.Group();
    const m = materialsFor(entry, envMap);
    const kit = new Kit(inner, m);
    try {
        (BUILD[entry.shape] || BUILD.jewel)(kit, entry);
    } catch (err) {
        console.warn('[Artifact] builder failed for', entry.id, err);
        while (inner.children.length) inner.remove(inner.children[0]);
        kit.sph(0.4, 'main');
    }
    if (m.main.metalness < 0.5 && entry.mat !== 'glass') {
        // Unpatterned non-metal objects get a little procedural surface variation.
        inner.traverse(o => { if (o.isMesh && !o.material.map && o.material !== m.dark) o.material.roughness = Math.min(1, o.material.roughness + 0.03); });
    }

    const box = new THREE.Box3().setFromObject(inner);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = target / Math.max(size.x, size.y, size.z, 0.001);
    inner.position.sub(center).multiplyScalar(scale);
    inner.scale.setScalar(scale);

    const group = new THREE.Group();
    group.add(inner);
    const materials = new Set();
    group.traverse(o => {
        if (!o.isMesh) return;
        (Array.isArray(o.material) ? o.material : [o.material]).forEach(mat => materials.add(mat));
    });
    group.userData = { entry, materials: [...materials], size: size.multiplyScalar(scale), isArtifact: true };
    return group;
}

/** Coat (amount 1) or clean (0) an artifact with soil of the given colour. */
export function setDirt(group, amount, soilColor) {
    const soil = new THREE.Color(soilColor);
    for (const mat of group.userData.materials || []) {
        const base = mat.userData.base;
        if (!base) continue;
        mat.color.copy(base.color).lerp(soil, amount * 0.85);
        mat.roughness = base.roughness + (1 - base.roughness) * amount;
        mat.metalness = base.metalness * (1 - amount * 0.85);
        if (mat.map) mat.color.lerp(soil, amount * 0.1);
    }
}

export function setGlow(group, color, intensity) {
    for (const mat of group.userData.materials || []) {
        mat.emissive.set(color);
        mat.emissiveIntensity = intensity;
    }
}

export function disposeObject(obj) {
    obj.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
    });
}

// ---------- Studio renderer: thumbnails ----------

let studio = null;

async function getStudio() {
    if (studio) return studio;
    const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');
    const canvas = document.createElement('canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(224, 224, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xfff1dc, 0x2a1d12, 1.4));
    const key = new THREE.DirectionalLight(0xfff0d8, 2.4);
    key.position.set(2, 3, 2.5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffc77a, 1.4);
    rim.position.set(-2, 1.5, -2);
    scene.add(rim);
    const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 20);
    studio = { renderer, scene, camera, env };
    return studio;
}

const thumbCache = new Map();

/** Create the thumbnail renderer ahead of time so the first discovery is instant. */
export function warmStudio() {
    return getStudio().then(s => s.renderer.compile(s.scene, s.camera)).catch(() => {});
}

/** Render (and cache) a transparent PNG thumbnail of an artifact. */
export async function artifactThumbnail(entry) {
    if (thumbCache.has(entry.id)) return thumbCache.get(entry.id);
    const promise = (async () => {
        try {
            const s = await getStudio();
            const model = buildArtifact(entry, { envMap: s.env, target: 1 });
            model.rotation.set(0.32, -0.6, 0);
            s.scene.add(model);
            const sphere = new THREE.Box3().setFromObject(model).getBoundingSphere(new THREE.Sphere());
            const dist = sphere.radius / Math.sin(THREE.MathUtils.degToRad(s.camera.fov / 2)) * 1.02;
            s.camera.position.set(0, sphere.radius * 0.35, dist).add(sphere.center);
            s.camera.lookAt(sphere.center);
            s.renderer.render(s.scene, s.camera);
            const url = s.renderer.domElement.toDataURL('image/png');
            s.scene.remove(model);
            disposeObject(model);
            return url;
        } catch (e) {
            console.warn('[Artifact] thumbnail failed', e);
            return '';
        }
    })();
    thumbCache.set(entry.id, promise);
    return promise;
}
