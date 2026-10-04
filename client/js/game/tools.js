// ============================================
// TOOLS — 3D tool models and their excavation animations.
// Every model's origin is the working tip; the handle extends up +Y.
// ============================================

import * as THREE from 'three';

const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeIn = t => t * t * t;
const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function mat(color, metal = 0, rough = 0.7) {
    return new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough });
}

function withShadows(obj) {
    obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return obj;
}

function buildTrowel() {
    const g = new THREE.Group();
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.lineTo(0.07, 0.15); s.lineTo(0.0, 0.2); s.lineTo(-0.07, 0.15); s.closePath();
    const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.006, bevelEnabled: false }), mat(0xb9bcc0, 0.95, 0.32));
    blade.position.z = -0.003;
    g.add(blade);
    const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.09, 6), mat(0x8a8d90, 0.9, 0.4));
    shank.position.set(0, 0.235, 0.02); shank.rotation.x = -0.5;
    g.add(shank);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.17, 12), mat(0x8a4f2a, 0, 0.6));
    handle.position.set(0, 0.36, 0.05);
    g.add(handle);
    return withShadows(g);
}

function buildBrush() {
    const g = new THREE.Group();
    const bristles = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.07, 0.035), mat(0x3d2b1e, 0, 1));
    bristles.position.y = 0.035;
    g.add(bristles);
    const ferrule = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.05, 0.04), mat(0xb08d57, 0.9, 0.35));
    ferrule.position.y = 0.095;
    g.add(ferrule);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.026, 0.3, 12), mat(0xc8402e, 0, 0.45));
    handle.position.y = 0.27;
    g.add(handle);
    return withShadows(g);
}

function buildProbe() {
    const g = new THREE.Group();
    const steel = mat(0xb5b8bc, 0.95, 0.3);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.05, 8), steel);
    tip.rotation.x = Math.PI; tip.position.y = 0.025;
    g.add(tip);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.95, 8), steel);
    rod.position.y = 0.52;
    g.add(rod);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.22, 10), mat(0x2b2723, 0, 0.6));
    handle.rotation.z = Math.PI / 2; handle.position.y = 1.0;
    g.add(handle);
    return withShadows(g);
}

function buildFallbackShovel() {
    const g = new THREE.Group();
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.3, 0.02), mat(0x777b80, 0.85, 0.4));
    blade.position.y = 0.15;
    g.add(blade);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.95, 10), mat(0x8a5a33, 0, 0.7));
    handle.position.y = 0.78;
    g.add(handle);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.18, 8), mat(0x8a5a33, 0, 0.7));
    grip.rotation.z = Math.PI / 2; grip.position.y = 1.24;
    g.add(grip);
    return withShadows(g);
}

async function loadShovel() {
    try {
        const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
        const gltf = await Promise.race([
            new GLTFLoader().loadAsync('/public/models/low_poly_wooden_shovel.glb'),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 12000)),
        ]);
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        model.scale.setScalar(1.25 / Math.max(size.x, size.y, size.z));
        // blade down, then put the blade tip at the origin
        const pivot = new THREE.Group();
        model.rotation.set(Math.PI, 0, 0);
        pivot.add(model);
        const b2 = new THREE.Box3().setFromObject(pivot);
        const c = b2.getCenter(new THREE.Vector3());
        model.position.set(-c.x, -b2.min.y, -c.z);
        const g = new THREE.Group();
        g.add(pivot);
        return withShadows(g);
    } catch (e) {
        console.warn('[Tools] shovel model unavailable, using fallback', e.message);
        return buildFallbackShovel();
    }
}

/** Rest pose relative to the hover point: lifted, leaning toward the camera. */
const REST = {
    shovel: { lift: 0.35, rx: -0.42, rz: 0.32 },
    trowel: { lift: 0.14, rx: -0.6, rz: 0.4 },
    brush: { lift: 0.12, rx: -0.5, rz: 0.35 },
    probe: { lift: 0.25, rx: -0.2, rz: 0.15 },
};

export class ToolRig {
    constructor(scene) {
        this.scene = scene;
        this.models = {};
        this.current = 'shovel';
        this.hover = new THREE.Vector3(3.4, 0.2, 3.2);
        this.target = this.hover.clone();
        this.busy = false;
        this.visible = true;
        this.queue = null;
        this.idleT = 0;
    }

    async init() {
        this.models.shovel = await loadShovel();
        this.models.trowel = buildTrowel();
        this.models.brush = buildBrush();
        this.models.probe = buildProbe();
        for (const [name, m] of Object.entries(this.models)) {
            m.visible = name === this.current;
            m.position.copy(this.hover);
            this.scene.add(m);
        }
    }

    get model() { return this.models[this.current]; }

    setVisible(v) {
        this.visible = v;
        for (const [name, m] of Object.entries(this.models)) m.visible = v && name === this.current;
    }

    setTool(name) {
        if (!this.models[name] || name === this.current) return;
        const prev = this.model;
        this.current = name;
        const next = this.model;
        next.position.copy(prev ? prev.position : this.hover);
        next.position.y += 0.25;
        next.visible = this.visible;
        if (prev) prev.visible = false;
        next.userData.pop = 0; // scale-in pop
    }

    /** Where the tool should idle (the hovered unit). */
    setHover(point) {
        if (point) this.target.copy(point);
    }

    update(dt) {
        const m = this.model;
        if (!m || this.busy) return;
        this.idleT += dt;
        const rest = REST[this.current];
        const goal = this.target.clone();
        goal.y += rest.lift + Math.sin(this.idleT * 2.2) * 0.015;
        m.position.lerp(goal, 1 - Math.pow(0.0005, dt));
        m.rotation.x = lerp(m.rotation.x, rest.rx, 1 - Math.pow(0.001, dt));
        m.rotation.y = lerp(m.rotation.y, 0, 1 - Math.pow(0.001, dt));
        m.rotation.z = lerp(m.rotation.z, rest.rz + Math.sin(this.idleT * 1.3) * 0.02, 1 - Math.pow(0.001, dt));
        if (m.userData.pop != null) {
            m.userData.pop = Math.min(1, m.userData.pop + dt * 5);
            m.scale.setScalar(0.6 + 0.4 * easeOut(m.userData.pop) + Math.sin(m.userData.pop * Math.PI) * 0.12);
            if (m.userData.pop >= 1) { m.userData.pop = null; m.scale.setScalar(1); }
        }
    }

    /**
     * Animate a tool action at `point`. onImpact fires when the tool bites the soil.
     * opts.tossTo: where the shovel throws its soil. Resolves when the motion ends.
     */
    play(tool, point, { onImpact, onToss, tossTo, fast = false } = {}) {
        if (this.busy) return Promise.resolve(false);
        this.setTool(tool);
        const m = this.model;
        if (!m) { onImpact?.(); return Promise.resolve(true); }
        this.busy = true;
        const speed = fast ? 1.7 : 1;
        const lead = 0.07; // blend from wherever the tool is hovering
        const keys = [
            { t: 0, p: m.position.clone(), r: [m.rotation.x, m.rotation.y, m.rotation.z] },
            ...this.keyframes(tool, point, tossTo).map(kf => ({ ...kf, t: kf.t + lead })),
        ];
        const total = keys[keys.length - 1].t;
        const impactKey = keys.find(kf => kf.impact);
        const tossKey = keys.find(kf => kf.toss);
        let impacted = false, tossed = false;
        return new Promise(resolve => {
            const t0 = performance.now();
            const step = now => {
                const t = Math.min(total, ((now - t0) / 1000) * speed);
                let i = 0;
                while (i < keys.length - 2 && keys[i + 1].t <= t) i++;
                const a = keys[i], b = keys[i + 1];
                const k = (b.ease || easeInOut)(Math.min(1, Math.max(0, (t - a.t) / Math.max(1e-4, b.t - a.t))));
                m.position.lerpVectors(a.p, b.p, k);
                m.rotation.set(lerp(a.r[0], b.r[0], k), lerp(a.r[1], b.r[1], k), lerp(a.r[2], b.r[2], k));
                if (!impacted && impactKey && t >= impactKey.t) { impacted = true; onImpact?.(); }
                if (!tossed && tossKey && t >= tossKey.t) { tossed = true; onToss?.(m.position.clone()); }
                if (t < total) { requestAnimationFrame(step); return; }
                if (!impacted) onImpact?.();
                this.busy = false;
                resolve(true);
            };
            requestAnimationFrame(step);
        });
    }

    keyframes(tool, point, tossTo) {
        const P = (dx, dy, dz) => new THREE.Vector3(point.x + dx, point.y + dy, point.z + dz);
        if (tool === 'shovel') {
            const toss = tossTo ? tossTo.clone().lerp(point, 0.55).add(new THREE.Vector3(0, 0.9, 0)) : P(0.8, 0.9, 0.3);
            return [
                { t: 0.0, p: P(0, 0.55, 0.32), r: [-0.55, 0, 0.1], ease: easeOut },
                { t: 0.12, p: P(0, 0.55, 0.32), r: [-0.55, 0, 0.1] },
                { t: 0.24, p: P(0, -0.05, 0.12), r: [-0.32, 0, 0.04], ease: easeIn, impact: true },
                { t: 0.38, p: P(0, 0.06, 0.28), r: [-1.05, 0, 0.04], ease: easeOut },
                { t: 0.52, p: P(0.1, 0.5, 0.32), r: [-0.9, -0.2, 0.05] },
                { t: 0.66, p: toss, r: [-0.2, -1.0, 0.7], ease: easeOut, toss: true },
                { t: 0.84, p: P(0.15, 0.4, 0.2), r: [REST.shovel.rx, 0, REST.shovel.rz] },
            ];
        }
        if (tool === 'trowel') {
            return [
                { t: 0.0, p: P(-0.06, 0.16, 0.12), r: [-0.95, 0, 0.5] },
                { t: 0.1, p: P(-0.06, 0.02, 0.06), r: [-1.15, 0, 0.5], ease: easeIn, impact: true },
                { t: 0.22, p: P(0.1, 0.04, 0.02), r: [-1.2, 0.3, 0.6] },
                { t: 0.3, p: P(-0.04, 0.03, 0.08), r: [-1.15, 0, 0.5] },
                { t: 0.42, p: P(0.12, 0.08, 0.02), r: [-1.2, 0.3, 0.6], toss: true },
                { t: 0.56, p: P(0.05, 0.16, 0.1), r: [REST.trowel.rx, 0, REST.trowel.rz] },
            ];
        }
        if (tool === 'brush') {
            return [
                { t: 0.0, p: P(-0.12, 0.08, 0.05), r: [-0.6, 0, 0.6] },
                { t: 0.1, p: P(-0.12, 0.02, 0.05), r: [-0.7, 0, 0.7] },
                { t: 0.22, p: P(0.12, 0.02, 0.02), r: [-0.7, 0, -0.1], impact: true },
                { t: 0.34, p: P(-0.08, 0.02, 0.06), r: [-0.7, 0, 0.6] },
                { t: 0.46, p: P(0.1, 0.03, 0.02), r: [-0.7, 0, -0.1], toss: true },
                { t: 0.58, p: P(0.0, 0.12, 0.05), r: [REST.brush.rx, 0, REST.brush.rz] },
            ];
        }
        // probe
        return [
            { t: 0.0, p: P(0, 0.55, 0), r: [0, 0, 0], ease: easeOut },
            { t: 0.14, p: P(0, 0.5, 0), r: [0, 0, 0] },
            { t: 0.3, p: P(0, -0.32, 0), r: [0, 0, 0], ease: easeIn, impact: true },
            { t: 0.42, p: P(0, -0.28, 0), r: [0, 0.4, 0] },
            { t: 0.6, p: P(0, 0.45, 0), r: [REST.probe.rx, 0, REST.probe.rz], ease: easeOut },
        ];
    }
}
