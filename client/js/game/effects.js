// ============================================
// EFFECTS — pooled particles and short-lived visual flourishes.
// ============================================

import * as THREE from 'three';

function softTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

function sparkTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,240,200,0.6)');
    g.addColorStop(1, 'rgba(255,220,150,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(32, 2); ctx.lineTo(32, 62); ctx.moveTo(2, 32); ctx.lineTo(62, 32); ctx.stroke();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

const tmpMatrix = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpScale = new THREE.Vector3();
const tmpEuler = new THREE.Euler();

export class Effects {
    constructor(scene) {
        this.scene = scene;
        this.enabled = true;
        this.reduced = false;
        this.timed = [];

        // Dirt clods
        this.clodMax = 360;
        const clodGeo = new THREE.IcosahedronGeometry(0.035, 0);
        const clodMat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, flatShading: true });
        this.clods = new THREE.InstancedMesh(clodGeo, clodMat, this.clodMax);
        this.clods.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.clods.castShadow = true;
        this.clods.frustumCulled = false;
        this.clodData = Array.from({ length: this.clodMax }, () => ({ life: 0 }));
        for (let i = 0; i < this.clodMax; i++) {
            this.clods.setMatrixAt(i, tmpMatrix.makeScale(0, 0, 0));
            this.clods.setColorAt(i, new THREE.Color(0x6b4a2b));
        }
        this.clodCursor = 0;
        scene.add(this.clods);

        // Billboard sprites: dust and sparkles
        this.dustTex = softTexture('rgba(255,245,225,0.9)', 'rgba(255,245,225,0)');
        this.sparkTex = sparkTexture();
        this.sprites = [];
        for (let i = 0; i < 90; i++) {
            const mat = new THREE.SpriteMaterial({ map: this.dustTex, transparent: true, depthWrite: false, opacity: 0 });
            const s = new THREE.Sprite(mat);
            s.visible = false;
            s.userData = { life: 0 };
            scene.add(s);
            this.sprites.push(s);
        }
        this.spriteCursor = 0;

        // Ambient motes drifting in the lamplight
        const moteCount = 160;
        const motePos = new Float32Array(moteCount * 3);
        this.moteSeed = new Float32Array(moteCount);
        for (let i = 0; i < moteCount; i++) {
            motePos[i * 3] = (Math.random() - 0.5) * 12;
            motePos[i * 3 + 1] = Math.random() * 3.5;
            motePos[i * 3 + 2] = (Math.random() - 0.5) * 12;
            this.moteSeed[i] = Math.random() * 100;
        }
        const moteGeo = new THREE.BufferGeometry();
        moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
        this.motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({
            size: 0.045, map: this.dustTex, transparent: true, opacity: 0.55, depthWrite: false,
            color: 0xffd9a0, blending: THREE.AdditiveBlending,
        }));
        scene.add(this.motes);
    }

    setEnabled(on) {
        this.enabled = on;
        this.motes.visible = on;
    }

    // ---------- dirt ----------

    /** Burst of soil clods. dir: optional THREE.Vector3 bias; floorY: where they come to rest. */
    clodBurst(origin, color, { count = 14, spread = 0.25, up = 1.6, dir = null, speed = 1, floorY = -1 } = {}) {
        const n = this.enabled ? count : Math.ceil(count / 3);
        const base = new THREE.Color(color);
        for (let i = 0; i < n; i++) {
            const idx = this.clodCursor;
            this.clodCursor = (this.clodCursor + 1) % this.clodMax;
            const d = this.clodData[idx];
            d.pos = origin.clone().add(new THREE.Vector3((Math.random() - 0.5) * spread, Math.random() * 0.05, (Math.random() - 0.5) * spread));
            d.vel = new THREE.Vector3((Math.random() - 0.5) * 1.2, up * (0.6 + Math.random() * 0.6), (Math.random() - 0.5) * 1.2).multiplyScalar(speed);
            if (dir) d.vel.add(dir.clone().multiplyScalar(0.8 + Math.random() * 0.5));
            d.rot = new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6);
            d.spin = new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8);
            d.size = 0.6 + Math.random() * 1.1;
            d.life = 1.6 + Math.random() * 0.6;
            d.floorY = floorY;
            d.rested = false;
            const c = base.clone().multiplyScalar(0.75 + Math.random() * 0.45);
            this.clods.setColorAt(idx, c);
        }
        this.clods.instanceColor.needsUpdate = true;
    }

    // ---------- sprites ----------

    sprite({ pos, vel = new THREE.Vector3(), color = 0xffffff, size = 0.4, grow = 1.5, life = 0.8, opacity = 0.7, spark = false, additive = false }) {
        const s = this.sprites[this.spriteCursor];
        this.spriteCursor = (this.spriteCursor + 1) % this.sprites.length;
        s.material.map = spark ? this.sparkTex : this.dustTex;
        s.material.color.set(color);
        s.material.blending = additive || spark ? THREE.AdditiveBlending : THREE.NormalBlending;
        s.material.needsUpdate = true;
        s.position.copy(pos);
        s.scale.setScalar(size);
        s.visible = true;
        Object.assign(s.userData, { life, max: life, vel, size, grow, opacity });
        return s;
    }

    dust(pos, color = 0xd8c3a0, count = 5, spread = 0.3) {
        const n = this.enabled ? count : Math.min(2, count);
        for (let i = 0; i < n; i++) {
            this.sprite({
                pos: pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * spread, 0.05 + Math.random() * 0.1, (Math.random() - 0.5) * spread)),
                vel: new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.25 + Math.random() * 0.3, (Math.random() - 0.5) * 0.3),
                color, size: 0.25 + Math.random() * 0.25, grow: 2.2, life: 0.9 + Math.random() * 0.5, opacity: 0.45,
            });
        }
    }

    sparkles(pos, color, count = 10, radius = 0.35, rise = 0.6) {
        const n = this.enabled ? count : Math.ceil(count / 3);
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2;
            const r = Math.random() * radius;
            this.sprite({
                pos: pos.clone().add(new THREE.Vector3(Math.cos(a) * r, Math.random() * 0.2, Math.sin(a) * r)),
                vel: new THREE.Vector3(Math.cos(a) * 0.1, rise * (0.5 + Math.random()), Math.sin(a) * 0.1),
                color, size: 0.08 + Math.random() * 0.1, grow: 0.4, life: 0.8 + Math.random() * 0.8, opacity: 1, spark: true,
            });
        }
    }

    // ---------- shapes ----------

    ring(pos, color, { radius = 0.6, life = 0.7, width = 0.06 } = {}) {
        const geo = new THREE.RingGeometry(0.1, 0.1 + width, 48);
        const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.copy(pos);
        this.scene.add(mesh);
        this.timed.push({ t: 0, life, update: k => {
            const s = 1 + k * (radius / 0.1);
            mesh.scale.set(s, s, s);
            mat.opacity = 0.9 * (1 - k);
        }, done: () => { this.scene.remove(mesh); geo.dispose(); mat.dispose(); } });
    }

    beam(pos, color, { height = 3, radius = 0.35, life = 2.2 } = {}) {
        const geo = new THREE.CylinderGeometry(radius * 0.5, radius, height, 24, 1, true);
        geo.translate(0, height / 2, 0);
        const mat = new THREE.ShaderMaterial({
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
            uniforms: { uColor: { value: new THREE.Color(color) }, uFade: { value: 0 } },
            vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
            fragmentShader: 'uniform vec3 uColor; uniform float uFade; varying vec2 vUv; void main(){ float a = (1.0 - vUv.y) * (0.55 + 0.45 * sin(vUv.x * 40.0)) * uFade; gl_FragColor = vec4(uColor * a, a); }',
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(pos);
        this.scene.add(mesh);
        this.timed.push({ t: 0, life, update: k => {
            mat.uniforms.uFade.value = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
            mesh.scale.set(1 + k * 0.3, 1, 1 + k * 0.3);
            mesh.rotation.y += 0.01;
        }, done: () => { this.scene.remove(mesh); geo.dispose(); mat.dispose(); } });
    }

    /** Run fn(k) for `life` seconds (k 0→1), then onDone. Returns a cancel function. */
    tween(life, fn, onDone) {
        const item = { t: 0, life, update: fn, done: onDone };
        this.timed.push(item);
        return () => { item.cancelled = true; };
    }

    update(dt, time) {
        // clods
        let dirty = false;
        for (let i = 0; i < this.clodMax; i++) {
            const d = this.clodData[i];
            if (d.life <= 0) continue;
            dirty = true;
            d.life -= dt;
            if (!d.rested) {
                d.vel.y -= 9.8 * dt;
                d.pos.addScaledVector(d.vel, dt);
                d.rot.addScaledVector(d.spin, dt);
                if (d.pos.y < d.floorY) {
                    d.pos.y = d.floorY;
                    if (Math.abs(d.vel.y) > 1.2) { d.vel.y *= -0.3; d.vel.x *= 0.5; d.vel.z *= 0.5; }
                    else d.rested = true;
                }
            }
            const fade = Math.min(1, d.life / 0.5);
            const s = d.size * fade;
            tmpScale.set(s, s, s);
            tmpQuat.setFromEuler(tmpEuler.set(d.rot.x, d.rot.y, d.rot.z));
            tmpMatrix.compose(d.pos, tmpQuat, tmpScale);
            this.clods.setMatrixAt(i, tmpMatrix);
            if (d.life <= 0) this.clods.setMatrixAt(i, tmpMatrix.makeScale(0, 0, 0));
        }
        if (dirty) this.clods.instanceMatrix.needsUpdate = true;

        // sprites
        for (const s of this.sprites) {
            const u = s.userData;
            if (u.life <= 0) continue;
            u.life -= dt;
            const k = 1 - u.life / u.max;
            s.position.addScaledVector(u.vel, dt);
            s.scale.setScalar(u.size * (1 + k * u.grow));
            s.material.opacity = u.opacity * (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85);
            if (u.life <= 0) s.visible = false;
        }

        // motes
        if (this.motes.visible) {
            const pos = this.motes.geometry.attributes.position;
            for (let i = 0; i < pos.count; i++) {
                const sd = this.moteSeed[i];
                let y = pos.getY(i) + dt * (0.05 + (sd % 1) * 0.06);
                if (y > 3.6) y = 0;
                pos.setXYZ(i, pos.getX(i) + Math.sin(time * 0.3 + sd) * dt * 0.08, y, pos.getZ(i) + Math.cos(time * 0.25 + sd) * dt * 0.08);
            }
            pos.needsUpdate = true;
        }

        // timed
        for (let i = this.timed.length - 1; i >= 0; i--) {
            const it = this.timed[i];
            if (it.cancelled) { this.timed.splice(i, 1); continue; }
            it.t += dt;
            const k = Math.min(1, it.t / it.life);
            it.update(k);
            if (k >= 1) { this.timed.splice(i, 1); it.done?.(); }
        }
    }
}
