// ============================================
// EXCAVATION SCENE — renderer, camera, field environment and the trench.
//
// The trench is a stepped heightfield: every excavation unit is a column whose
// top sits at -depth × LAYER_T. A single strata shader colours all soil by its
// world height, so pit walls automatically show the layers you dug through.
// ============================================

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GRID, LAYERS, cellX, cellZ, cellIndex, sherdVisible, stainVisible, mulberry32 } from './site.js';
import { buildArtifact, setDirt, setGlow, disposeObject } from './artifactModels.js';
import { RARITIES } from '../data/catalog.js';
import { Effects } from './effects.js';
import { ToolRig } from './tools.js';

export const SITE_SIZE = 5;
export const CELL = SITE_SIZE / GRID;
export const LAYER_T = 0.24;
const HALF = SITE_SIZE / 2;
const SUB = 3;
const STEP = CELL / SUB;

export const RARITY_COLORS = { common: 0xe2d3b0, uncommon: 0x7fc796, rare: 0x6eaaf0, legendary: 0xf2bb4c };

const SOIL = {
    sand: { layers: [0xcaa36c, 0xb3804a, 0x8a5b3b, 0xbca88b], grass: 0, spoil: 0xb88d58 },
    dirt: { layers: [0x7b5d41, 0xa38660, 0x5c4838, 0x8e8981], grass: 0.35, spoil: 0x8a6c4c },
    soil: { layers: [0x4b3726, 0x7c5735, 0x9b6b3d, 0x5f5c58], grass: 0.6, spoil: 0x5e4430 },
};

const TOOL_COLORS = { shovel: 0xf0c66a, trowel: 0x9ad48a, brush: 0xf3e3c0, probe: 0x8fb0f0, blocked: 0xe0705a };

// ---------- value noise ----------

function makeNoise(seed) {
    const rng = mulberry32(seed);
    const perm = new Uint8Array(512);
    const p = [...Array(256).keys()];
    for (let i = 255; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    const hash = (x, z) => perm[(x & 255) + perm[z & 255]] / 255;
    const smooth = t => t * t * (3 - 2 * t);
    return (x, z) => {
        const x0 = Math.floor(x), z0 = Math.floor(z);
        const sx = smooth(x - x0), sz = smooth(z - z0);
        const a = hash(x0, z0), b = hash(x0 + 1, z0), c = hash(x0, z0 + 1), d = hash(x0 + 1, z0 + 1);
        return (a + (b - a) * sx) * (1 - sz) + (c + (d - c) * sx) * sz;
    };
}

// ---------- strata material ----------

const STRATA_VERT_HEAD = 'varying vec3 vWPos;\n';
const STRATA_FRAG_HEAD = `
varying vec3 vWPos;
uniform vec3 uLayers[4];
uniform float uT;
uniform float uGrass;
uniform vec3 uGrassColor;
uniform vec4 uHover;
uniform vec3 uHoverColor;
uniform float uHoverOn;
uniform vec4 uCursor;
uniform float uCursorOn;
uniform float uTime;
uniform vec4 uStains[6];
uniform float uSiteHalf;

float sHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float sNoise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    float a = sHash(vec3(i, 0.0)), b = sHash(vec3(i + vec2(1.0, 0.0), 0.0));
    float c = sHash(vec3(i + vec2(0.0, 1.0), 0.0)), d = sHash(vec3(i + vec2(1.0, 1.0), 0.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float rectEdge(vec2 p, vec4 r) {
    vec2 d = min(p - r.xy, r.zw - p);
    return min(d.x, d.y);
}
`;

const STRATA_FRAG_BODY = `
    vec3 p = vWPos;
    vec3 fn = normalize(cross(dFdx(vWPos), dFdy(vWPos)));
    float up = fn.y;
    float wave = (sNoise(p.xz * 2.3) - 0.5) * 0.05 + (sNoise(p.xz * 7.1 + 3.0) - 0.5) * 0.016;
    float y = p.y + wave;
    float e = 0.008;
    vec3 col = uLayers[3];
    col = mix(col, uLayers[2], smoothstep(-3.0 * uT - e, -3.0 * uT + e, y));
    col = mix(col, uLayers[1], smoothstep(-2.0 * uT - e, -2.0 * uT + e, y));
    col = mix(col, uLayers[0], smoothstep(-uT - e, -uT + e, y));

    float g = sNoise(p.xz * 17.0 + p.y * 9.0) * 0.6 + sNoise(p.xz * 5.0 - p.y * 3.0) * 0.4;
    col *= 0.84 + 0.3 * g;
    float speck = sHash(floor(p * 46.0));
    float inOcc = step(-3.0 * uT, y) * step(y, -2.0 * uT);
    if (speck > 0.962) col *= mix(1.25, 0.32, inOcc);
    // horizontal bedding lines in walls
    if (up < 0.4) col *= 0.93 + 0.07 * sin(y * 160.0 + sNoise(p.xz * 3.0) * 6.0);

    float grassMask = uGrass * smoothstep(0.55, 0.85, up) * smoothstep(-0.035, 0.0, p.y)
        * smoothstep(0.4, 0.7, sNoise(p.xz * 1.4) * 0.7 + sNoise(p.xz * 6.0) * 0.3);
    col = mix(col, uGrassColor * (0.75 + 0.45 * g), grassMask);

    // soil stains above deep finds
    for (int i = 0; i < 6; i++) {
        vec4 s = uStains[i];
        if (s.w > 0.5) {
            float dist = length(p.xz - s.xy) + (sNoise(p.xz * 9.0) - 0.5) * 0.08;
            float stain = (1.0 - smoothstep(s.z * 0.55, s.z, dist)) * smoothstep(0.5, 0.8, up);
            col = mix(col, col * vec3(0.38, 0.33, 0.3), stain * 0.85);
        }
    }

    // inside the trench: deeper = darker (cheap occlusion)
    float inside = step(abs(p.x), uSiteHalf) * step(abs(p.z), uSiteHalf);
    col *= 1.0 - inside * 0.26 * smoothstep(0.0, 3.0 * uT, -p.y);
    if (up < 0.45) col *= 0.86;

    float topFace = smoothstep(0.55, 0.8, up);
    if (uHoverOn > 0.5) {
        float d = rectEdge(p.xz, uHover);
        if (d > 0.0) {
            float pulse = 0.16 + 0.06 * sin(uTime * 5.0);
            col = mix(col, uHoverColor, topFace * pulse);
            col = mix(col, uHoverColor, topFace * (1.0 - smoothstep(0.012, 0.03, d)) * 0.85);
        }
    }
    if (uCursorOn > 0.5) {
        float d = rectEdge(p.xz, uCursor);
        if (d > 0.0) col = mix(col, vec3(1.0, 0.95, 0.85), topFace * (1.0 - smoothstep(0.01, 0.025, d)) * 0.9);
    }
    diffuseColor.rgb = col;
`;

function createStrataMaterial() {
    const uniforms = {
        uLayers: { value: [new THREE.Color(), new THREE.Color(), new THREE.Color(), new THREE.Color()] },
        uT: { value: LAYER_T },
        uGrass: { value: 0 },
        uGrassColor: { value: new THREE.Color(0x5d6b34) },
        uHover: { value: new THREE.Vector4() },
        uHoverColor: { value: new THREE.Color(TOOL_COLORS.shovel) },
        uHoverOn: { value: 0 },
        uCursor: { value: new THREE.Vector4() },
        uCursorOn: { value: 0 },
        uTime: { value: 0 },
        uStains: { value: Array.from({ length: 6 }, () => new THREE.Vector4()) },
        uSiteHalf: { value: HALF },
    };
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.96, metalness: 0, flatShading: true });
    mat.onBeforeCompile = shader => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = STRATA_VERT_HEAD + shader.vertexShader.replace(
            '#include <project_vertex>',
            '#include <project_vertex>\n    vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        shader.fragmentShader = STRATA_FRAG_HEAD + shader.fragmentShader.replace('#include <color_fragment>', STRATA_FRAG_BODY);
    };
    mat.userData.uniforms = uniforms;
    return mat;
}

// ---------- sky ----------

function createSky() {
    const geo = new THREE.SphereGeometry(90, 32, 16);
    const mat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: { uTime: { value: 0 }, uSun: { value: new THREE.Vector3(-0.55, 0.22, -0.8).normalize() } },
        vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
        fragmentShader: `
            varying vec3 vDir; uniform float uTime; uniform vec3 uSun;
            float h1(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453); }
            void main(){
                float h = vDir.y;
                vec3 hor = vec3(0.86, 0.56, 0.34);
                vec3 mid = vec3(0.36, 0.27, 0.30);
                vec3 top = vec3(0.07, 0.09, 0.16);
                vec3 col = mix(hor, mid, smoothstep(0.02, 0.22, h));
                col = mix(col, top, smoothstep(0.22, 0.75, h));
                col = mix(col, vec3(0.42, 0.30, 0.22), smoothstep(0.0, -0.15, h));
                float sun = max(dot(vDir, uSun), 0.0);
                col += vec3(1.0, 0.72, 0.42) * (pow(sun, 18.0) * 0.45 + pow(sun, 400.0) * 1.6);
                vec3 q = floor(vDir * 260.0);
                float star = step(0.9975, h1(q)) * smoothstep(0.3, 0.7, h);
                col += star * (0.6 + 0.4 * sin(uTime * 2.0 + h1(q + 1.0) * 20.0)) * 0.7;
                gl_FragColor = vec4(col, 1.0);
                #include <colorspace_fragment>
            }`,
    });
    const sky = new THREE.Mesh(geo, mat);
    sky.frustumCulled = false;
    sky.renderOrder = -1;
    return sky;
}

// ---------- scene ----------

export class ExcavationScene {
    constructor(canvas) {
        this.canvas = canvas;
        this.site = null;
        this.mode = 'menu';
        this.findObjects = new Map(); // find.index -> { holder, model, find }
        this.flags = new Map();
        this.sherds = new Map();
        this.trayIndex = 0;
        this.shakeAmount = 0;
        this.clock = new THREE.Clock();
        this.listeners = new Set();
        this.reducedMotion = false;
        this.menuAngle = 0.6;
        this.cursorCell = null;
        this.focusTween = null;
    }

    async init() {
        const isMobile = matchMedia('(pointer: coarse)').matches;
        const renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: !isMobile || devicePixelRatio < 2, powerPreference: 'high-performance' });
        renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.6 : 1.75));
        renderer.setSize(innerWidth, innerHeight, false);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.05;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer = renderer;

        const scene = new THREE.Scene();
        scene.fog = new THREE.Fog(0x7a5640, 18, 52);
        this.scene = scene;

        const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 200);
        camera.position.set(0, 7, 7.6);
        this.camera = camera;
        this.basePos = camera.position.clone();

        const controls = new OrbitControls(camera, this.canvas);
        controls.target.set(0, -0.15, 0);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.enablePan = false;
        controls.minDistance = 4.2;
        controls.maxDistance = 13;
        controls.minPolarAngle = 0.25;
        controls.maxPolarAngle = 1.18;
        controls.rotateSpeed = 0.6;
        controls.zoomSpeed = 0.8;
        controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
        controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };
        controls.enabled = false;
        this.controls = controls;

        // Environment lighting for artifact reflections only (terrain uses the lights)
        const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');
        const pmrem = new THREE.PMREMGenerator(renderer);
        this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        pmrem.dispose();

        this.sky = createSky();
        scene.add(this.sky);
        this.setupLights(isMobile);

        this.strata = createStrataMaterial();
        this.noise = makeNoise(7);
        this.buildGround();
        this.buildProps();
        this.buildGridStrings();

        this.effects = new Effects(scene);
        this.tools = new ToolRig(scene);
        await this.tools.init();

        addEventListener('resize', () => this.resize());
        this.renderer.setAnimationLoop(() => this.frame());
    }

    setupLights(isMobile) {
        const s = this.scene;
        s.add(new THREE.HemisphereLight(0xb7c4e0, 0x6a4a2c, 2.3));
        const sun = new THREE.DirectionalLight(0xffcf96, 2.5);
        sun.position.set(-6.5, 8, 6);
        sun.castShadow = true;
        sun.shadow.mapSize.set(isMobile ? 1024 : 2048, isMobile ? 1024 : 2048);
        Object.assign(sun.shadow.camera, { left: -6.5, right: 6.5, top: 6.5, bottom: -6.5, near: 1, far: 30 });
        sun.shadow.bias = -0.0006;
        sun.shadow.normalBias = 0.02;
        s.add(sun);
        s.add(sun.target);
        this.sun = sun;
        const fill = new THREE.DirectionalLight(0x9fb2dc, 0.7);
        fill.position.set(6, 4, -5);
        s.add(fill);
        // soft front fill so pit walls facing the camera never go black
        const front = new THREE.DirectionalLight(0xffe2c0, 0.55);
        front.position.set(2, 3, 9);
        s.add(front);
        this.lanterns = [];
    }

    // ---------- heights ----------

    surfaceY(depth, x, z) {
        const n = this.noise(x * 0.9, z * 0.9) * 0.7 + this.noise(x * 2.3 + 7, z * 2.3 + 3) * 0.3;
        if (depth === 0) {
            const dx = Math.max(Math.abs(x) - HALF, 0), dz = Math.max(Math.abs(z) - HALF, 0);
            const dist = Math.hypot(dx, dz);
            const far = THREE.MathUtils.smoothstep(dist, 0.8, 7) * (this.noise(x * 0.16 + 40, z * 0.16) - 0.35) * 1.4;
            return (n - 0.5) * 0.07 + far;
        }
        const floorNoise = depth >= LAYERS ? 0.012 : 0.035;
        return -depth * LAYER_T + (n - 0.5) * floorNoise;
    }

    groundY(x, z) { return this.surfaceY(0, x, z); }

    cellCenter(idx) {
        return { x: -HALF + (cellX(idx) + 0.5) * CELL, z: -HALF + (cellZ(idx) + 0.5) * CELL };
    }

    cellTop(idx) {
        const { x, z } = this.cellCenter(idx);
        const d = this.site ? this.site.depth[idx] : 0;
        return new THREE.Vector3(x, this.surfaceY(d, x, z), z);
    }

    // ---------- static environment ----------

    buildGround() {
        const coords = [];
        for (let k = 0; k <= GRID * SUB; k++) coords.push(-HALF + k * STEP);
        let s = STEP, x = HALF;
        while (x < 34) { s *= 1.14; x += s; coords.push(x); coords.unshift(-x); }
        const n = coords.length;
        const pos = new Float32Array(n * n * 3);
        for (let j = 0; j < n; j++) {
            for (let i = 0; i < n; i++) {
                const o = (j * n + i) * 3;
                pos[o] = coords[i]; pos[o + 2] = coords[j];
                pos[o + 1] = this.groundY(coords[i], coords[j]);
            }
        }
        const idx = [];
        const eps = 1e-6;
        for (let j = 0; j < n - 1; j++) {
            for (let i = 0; i < n - 1; i++) {
                const cx = (coords[i] + coords[i + 1]) / 2, cz = (coords[j] + coords[j + 1]) / 2;
                if (Math.abs(cx) < HALF - eps && Math.abs(cz) < HALF - eps) continue;
                const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
                idx.push(a, c, d, a, d, b);
            }
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setIndex(idx);
        geo.computeVertexNormals();
        this.ground = new THREE.Mesh(geo, this.strata);
        this.ground.receiveShadow = true;
        this.scene.add(this.ground);
    }

    buildProps() {
        const s = this.scene;
        const wood = new THREE.MeshStandardMaterial({ color: 0x8a6440, roughness: 0.85 });
        const darkWood = new THREE.MeshStandardMaterial({ color: 0x5a3f28, roughness: 0.9 });
        const canvas = new THREE.MeshStandardMaterial({ color: 0xcdbb94, roughness: 1, side: THREE.DoubleSide });
        const metal = new THREE.MeshStandardMaterial({ color: 0x7c7f83, metalness: 0.8, roughness: 0.45 });
        const add = (mesh, x, z, y = 0, shadow = true) => {
            mesh.position.set(x, this.groundY(x, z) + y, z);
            mesh.castShadow = shadow; mesh.receiveShadow = true;
            s.add(mesh);
            return mesh;
        };

        // Boardwalk around the trench
        const bw = 0.36, len = SITE_SIZE + bw * 2 + 0.08;
        for (const [x, z, rot] of [[0, HALF + bw / 2 + 0.04, 0], [0, -HALF - bw / 2 - 0.04, 0], [HALF + bw / 2 + 0.04, 0, Math.PI / 2], [-HALF - bw / 2 - 0.04, 0, Math.PI / 2]]) {
            const board = new THREE.Mesh(new THREE.BoxGeometry(len, 0.05, bw), wood);
            board.rotation.y = rot;
            add(board, x, z, 0.05);
            for (const off of [-0.11, 0.11]) {
                const seam = new THREE.Mesh(new THREE.BoxGeometry(len, 0.052, 0.008), darkWood);
                seam.rotation.y = rot;
                add(seam, x + (rot ? off : 0), z + (rot ? 0 : off), 0.05, false);
            }
        }

        // Corner pegs
        const pegGeo = new THREE.CylinderGeometry(0.025, 0.02, 0.4, 6);
        for (const [x, z] of [[-HALF, -HALF], [HALF, -HALF], [-HALF, HALF], [HALF, HALF]]) add(new THREE.Mesh(pegGeo, darkWood), x, z, 0.18);

        // Spoil heap — grows as soil is removed
        const heapGeo = new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2);
        const hp = heapGeo.attributes.position;
        const r = mulberry32(99);
        for (let i = 0; i < hp.count; i++) {
            const k = 1 + (r() - 0.5) * 0.18;
            hp.setXYZ(i, hp.getX(i) * k, hp.getY(i) * (1 + (r() - 0.5) * 0.1), hp.getZ(i) * k);
        }
        heapGeo.computeVertexNormals();
        this.spoilMat = new THREE.MeshStandardMaterial({ color: 0x8a6c4c, roughness: 1, flatShading: true });
        this.spoil = add(new THREE.Mesh(heapGeo, this.spoilMat), HALF + 1.75, -0.9, -0.02);
        this.spoil.scale.set(0.5, 0.18, 0.4);
        this.spoilBase = this.spoil.position.clone();

        // Finds table with a tray — recovered artifacts are laid out here
        const table = new THREE.Group();
        const top = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.8), wood);
        top.position.y = 0.62; table.add(top);
        for (const [lx, lz] of [[-0.68, -0.34], [0.68, -0.34], [-0.68, 0.34], [0.68, 0.34]]) {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.62, 6), darkWood);
            leg.position.set(lx, 0.31, lz); table.add(leg);
        }
        const tray = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.04, 0.5), new THREE.MeshStandardMaterial({ color: 0xd9ccb0, roughness: 0.9 }));
        tray.position.y = 0.665; table.add(tray);
        table.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        table.rotation.y = Math.PI / 2;
        add(table, -HALF - 1.45, 0.4, 0);
        this.trayOrigin = new THREE.Vector3(-HALF - 1.45, this.groundY(-HALF - 1.45, 0.4) + 0.71, 0.4);

        // Bucket and sieve
        const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.32, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0x3f5f7a, roughness: 0.6, side: THREE.DoubleSide }));
        add(bucket, -HALF - 0.6, HALF + 0.75, 0.17);
        const sieve = new THREE.Group();
        const frameGeo = new THREE.BoxGeometry(0.9, 0.06, 0.06);
        for (const [fx, fz, rot] of [[0, -0.3, 0], [0, 0.3, 0], [-0.42, 0, Math.PI / 2], [0.42, 0, Math.PI / 2]]) {
            const f = new THREE.Mesh(frameGeo, wood);
            f.scale.x = rot ? 0.7 : 1;
            f.position.set(fx, 0, fz); f.rotation.y = rot; sieve.add(f);
        }
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.6), new THREE.MeshStandardMaterial({ color: 0x9a9a95, metalness: 0.6, roughness: 0.5, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
        mesh.rotation.x = -Math.PI / 2; sieve.add(mesh);
        for (const [lx, lz, ly] of [[-0.4, -0.28, -0.25], [0.4, -0.28, -0.25], [-0.4, 0.28, -0.45], [0.4, 0.28, -0.45]]) {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, Math.abs(ly) * 2, 6), darkWood);
            leg.position.set(lx, ly, lz); sieve.add(leg);
        }
        sieve.rotation.x = 0.25; sieve.rotation.y = -0.5;
        add(sieve, HALF + 1.5, -HALF - 0.9, 0.5);

        // Crates
        const crateMat = new THREE.MeshStandardMaterial({ color: 0x7a5a38, roughness: 0.9 });
        add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 0.45), crateMat), HALF + 1.5, -HALF - 1.9, 0.22).rotation.y = 0.4;
        add(new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.35, 0.4), crateMat), HALF + 2.1, -HALF - 1.5, 0.17).rotation.y = -0.2;

        // Lanterns
        const lanternSpots = [[-HALF - 0.75, -HALF - 0.75, 1.55], [HALF + 0.8, -HALF - 0.8, 1.35]];
        for (const [lx, lz, ly] of lanternSpots) {
            if (ly > 1) add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, ly, 6), darkWood), lx, lz, ly / 2);
            const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.18, 8), new THREE.MeshStandardMaterial({ color: 0xffd28a, emissive: 0xffa040, emissiveIntensity: 2.2 }));
            add(glass, lx, lz, ly + 0.1, false);
            const cap = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.1, 8), metal);
            add(cap, lx, lz, ly + 0.24);
            const light = new THREE.PointLight(0xffa04a, 4, 7, 1.8);
            light.position.set(lx, this.groundY(lx, lz) + ly + 0.12, lz);
            s.add(light);
            this.lanterns.push({ light, glass, seed: Math.random() * 10, base: 4 });
        }

        // Tents in the distance, one lit from inside
        const tentShape = new THREE.Shape();
        tentShape.moveTo(-1.4, 0); tentShape.lineTo(1.4, 0); tentShape.lineTo(0, 1.7); tentShape.closePath();
        const tentGeo = new THREE.ExtrudeGeometry(tentShape, { depth: 3, bevelEnabled: false });
        tentGeo.translate(0, 0, -1.5);
        for (const [tx, tz, ry, lit] of [[3.2, -10.5, 0.25, true], [-6.8, -9.5, -0.5, false], [-11, -4, 1.2, false]]) {
            const tent = add(new THREE.Mesh(tentGeo, canvas), tx, tz, -0.02);
            tent.rotation.y = ry;
            if (lit) {
                const glow = new THREE.PointLight(0xffb060, 1.6, 5, 2);
                glow.position.set(tx, this.groundY(tx, tz) + 0.8, tz + 1.8);
                s.add(glow);
                const door = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.1), new THREE.MeshBasicMaterial({ color: 0xc9802f }));
                door.rotation.y = ry;
                add(door, tx + Math.sin(ry) * 1.52, tz + Math.cos(ry) * 1.52, 0.55, false);
            }
        }

        // Distant trees and hills for silhouette
        const treeMat = new THREE.MeshStandardMaterial({ color: 0x2d3324, roughness: 1, flatShading: true });
        const rr = mulberry32(5);
        for (let i = 0; i < 26; i++) {
            const a = rr() * Math.PI * 2, d = 14 + rr() * 16;
            const x = Math.cos(a) * d, z = Math.sin(a) * d - 4;
            if (z > 6) continue;
            const hgt = 1.5 + rr() * 2.5;
            add(new THREE.Mesh(new THREE.ConeGeometry(0.4 + rr() * 0.5, hgt, 6), treeMat), x, z, hgt / 2 - 0.05);
        }
        const hillMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2c, roughness: 1, flatShading: true });
        for (const [hx, hz, sx, sy] of [[-20, -32, 16, 5], [8, -38, 22, 7], [32, -24, 14, 4]]) {
            const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), hillMat);
            hill.scale.set(sx, sy, sx * 0.6);
            add(hill, hx, hz, -0.3, false);
        }
    }

    buildGridStrings() {
        const y = 0.07;
        const pts = [];
        for (let k = 0; k <= GRID; k++) {
            const t = -HALF + k * CELL;
            pts.push(-HALF, y, t, HALF, y, t);
            pts.push(t, y, -HALF, t, y, HALF);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
        this.strings = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xf6ead0, transparent: true, opacity: 0.42 }));
        this.scene.add(this.strings);

        // Unit labels painted on the boardwalk: columns A–H in front, rows 1–8 on the left
        const label = text => {
            const c = document.createElement('canvas');
            c.width = c.height = 64;
            const ctx = c.getContext('2d');
            ctx.font = '600 40px "IBM Plex Mono", monospace';
            ctx.fillStyle = 'rgba(40,26,14,0.85)';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(text, 32, 34);
            const tex = new THREE.CanvasTexture(c);
            tex.colorSpace = THREE.SRGBColorSpace;
            const m = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.24), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
            m.rotation.x = -Math.PI / 2;
            return m;
        };
        for (let i = 0; i < GRID; i++) {
            const t = -HALF + (i + 0.5) * CELL;
            const col = label(String.fromCharCode(65 + i));
            col.position.set(t, this.groundY(t, HALF + 0.22) + 0.081, HALF + 0.22);
            this.scene.add(col);
            const row = label(String(i + 1));
            row.position.set(-HALF - 0.22, this.groundY(-HALF - 0.22, t) + 0.081, t);
            this.scene.add(row);
        }
    }

    // ---------- trench ----------

    buildTrenchGeometry(depth) {
        const pos = [];
        const quad = (a, b, c, d) => pos.push(...a, ...b, ...c, ...a, ...c, ...d);
        const depthAt = (i, j) => (i < 0 || j < 0 || i >= GRID || j >= GRID ? 0 : depth[cellIndex(i, j)]);

        for (let j = 0; j < GRID; j++) {
            for (let i = 0; i < GRID; i++) {
                const d = depth[cellIndex(i, j)];
                const x0 = -HALF + i * CELL, z0 = -HALF + j * CELL;
                // top surface, SUB×SUB quads
                for (let b = 0; b < SUB; b++) {
                    for (let a = 0; a < SUB; a++) {
                        const xa = x0 + a * STEP, xb = xa + STEP, za = z0 + b * STEP, zb = za + STEP;
                        quad(
                            [xa, this.surfaceY(d, xa, za), za], [xa, this.surfaceY(d, xa, zb), zb],
                            [xb, this.surfaceY(d, xb, zb), zb], [xb, this.surfaceY(d, xb, za), za]);
                    }
                }
                // walls toward higher neighbours
                const sides = [
                    { n: depthAt(i - 1, j), edge: t => [x0, z0 + t], facing: [1, 0] },
                    { n: depthAt(i + 1, j), edge: t => [x0 + CELL, z0 + t], facing: [-1, 0] },
                    { n: depthAt(i, j - 1), edge: t => [x0 + t, z0], facing: [0, 1] },
                    { n: depthAt(i, j + 1), edge: t => [x0 + t, z0 + CELL], facing: [0, -1] },
                ];
                for (const side of sides) {
                    if (side.n >= d) continue;
                    for (let k = 0; k < SUB; k++) {
                        const [ax, az] = side.edge(k * STEP), [bx, bz] = side.edge((k + 1) * STEP);
                        const tA = [ax, this.surfaceY(side.n, ax, az), az], tB = [bx, this.surfaceY(side.n, bx, bz), bz];
                        const bA = [ax, this.surfaceY(d, ax, az), az], bB = [bx, this.surfaceY(d, bx, bz), bz];
                        // winding so the normal faces into the lower unit
                        const ex = bx - ax, ez = bz - az;
                        const nx = -ez, nz = ex; // normal of (tA,bA,bB) is (-ez, 0, ex)·sign
                        if (nx * side.facing[0] + nz * side.facing[1] > 0) quad(tA, bA, bB, tB);
                        else quad(tB, bB, bA, tA);
                    }
                }
            }
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.computeVertexNormals();
        geo.computeBoundingSphere();
        return geo;
    }

    // ---------- site lifecycle ----------

    loadSite(site, siteDef) {
        this.clearSite();
        this.site = site;
        this.siteDef = siteDef;
        this.noise = makeNoise(site.seed);
        this.rebuildGround();

        const palette = SOIL[siteDef?.soil] || SOIL.dirt;
        const u = this.strata.userData.uniforms;
        palette.layers.forEach((c, i) => u.uLayers.value[i].set(c));
        if (siteDef?.tint != null) u.uLayers.value[0].lerp(new THREE.Color(siteDef.tint), 0.45);
        u.uGrass.value = palette.grass;
        this.spoilMat.color.set(palette.spoil);
        this.soilColors = u.uLayers.value.map(c => c.getHex());

        this.trench = new THREE.Mesh(this.buildTrenchGeometry(site.depth), this.strata);
        this.trench.castShadow = true;
        this.trench.receiveShadow = true;
        this.scene.add(this.trench);

        for (const find of site.finds) this.placeFind(find);
        for (const c of site.sherds) this.placeSherd(c);
        this.trayIndex = 0;
        this.sync();
        this.tools.setHover(new THREE.Vector3(HALF + 0.4, 0.1, HALF + 0.4));
    }

    rebuildGround() {
        const pos = this.ground.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) pos.setY(i, this.groundY(pos.getX(i), pos.getZ(i)));
        pos.needsUpdate = true;
        this.ground.geometry.computeVertexNormals();
    }

    clearSite() {
        if (this.trench) {
            this.scene.remove(this.trench);
            this.trench.geometry.dispose();
            this.trench = null;
        }
        for (const obj of this.findObjects.values()) { this.scene.remove(obj.holder); disposeObject(obj.holder); }
        this.findObjects.clear();
        for (const f of this.flags.values()) { this.scene.remove(f); disposeObject(f); }
        this.flags.clear();
        for (const s of this.sherds.values()) { this.scene.remove(s); disposeObject(s); }
        this.sherds.clear();
        this.site = null;
        this.revealObj = null;
        this.controls.minDistance = 4.2;
        this.setHover(null);
        this.setCursor(null);
        this.strata.userData.uniforms.uStains.value.forEach(v => v.set(0, 0, 0, 0));
        if (this.spoil) this.spoil.scale.set(0.5, 0.18, 0.4);
    }

    placeFind(find) {
        const model = buildArtifact(find.entry, { envMap: this.envMap });
        const size = model.userData.size;
        // Finds lie on their side in the ground
        if (size.y > Math.max(size.x, size.z) * 0.9) model.rotation.z = Math.PI / 2;
        model.rotation.y = (find.index * 2.39) % (Math.PI * 2);
        const holder = new THREE.Group();
        holder.add(model);
        const box = new THREE.Box3().setFromObject(holder);
        const hgt = box.max.y - box.min.y;
        const { x, z } = this.cellCenter(find.cell);
        const floor = this.surfaceY(find.layer - 1, x, z);
        holder.userData = { buriedY: floor - box.max.y + hgt * 0.38, exposedY: floor - box.min.y - hgt * 0.15, floor, hgt };
        holder.position.set(x, holder.userData.buriedY, z);
        holder.visible = false;
        holder.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.userData.findIndex = find.index; } });
        setDirt(model, 1, this.soilColors[find.layer - 1]);
        this.scene.add(holder);
        this.findObjects.set(find.index, { holder, model, find });
    }

    placeSherd(cell) {
        const { x, z } = this.cellCenter(cell);
        const r = mulberry32(cell * 31 + this.site.seed);
        const group = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({ color: 0xc8703f, roughness: 0.8, side: THREE.DoubleSide, emissive: 0x3a1408, emissiveIntensity: 0.4 });
        for (let i = 0; i < 2; i++) {
            const geo = new THREE.SphereGeometry(0.16 - i * 0.05, 10, 6, 0, 1.2, 0.5, 0.8);
            const piece = new THREE.Mesh(geo, mat);
            const ox = (r() - 0.5) * CELL * 0.4, oz = (r() - 0.5) * CELL * 0.4;
            piece.position.set(ox, this.surfaceY(0, x + ox, z + oz) - 0.1, oz);
            piece.rotation.set(-1.25 + r() * 0.4, r() * 6, r() * 0.4);
            piece.castShadow = true;
            group.add(piece);
        }
        group.position.set(x, 0, z);
        this.scene.add(group);
        this.sherds.set(cell, group);
    }

    /** Bring every visual in line with the site state (call after any action). */
    sync() {
        const site = this.site;
        if (!site) return;
        if (this.trench) {
            const old = this.trench.geometry;
            this.trench.geometry = this.buildTrenchGeometry(site.depth);
            old.dispose();
        }
        for (const [cell, mesh] of this.sherds) mesh.visible = sherdVisible(site, cell);
        const stains = this.strata.userData.uniforms.uStains.value;
        stains.forEach(v => v.set(0, 0, 0, 0));
        let si = 0;
        for (const f of site.finds) {
            if (stainVisible(site, f) && si < stains.length) {
                const { x, z } = this.cellCenter(f.cell);
                stains[si++].set(x + 0.04, z - 0.03, 0.3, 1);
            }
            const obj = this.findObjects.get(f.index);
            if (!obj || obj.flying) continue;
            obj.holder.visible = f.state === 'exposed';
        }
        for (const [cell, flag] of this.flags) flag.position.y = this.cellTop(cell).y;
        // spoil heap grows with excavated volume
        const v = Math.sqrt(site.volume || 0);
        const k = Math.min(1, v / 14);
        this.spoil.scale.set(0.5 + k * 1.15, 0.18 + k * 0.62, 0.4 + k * 0.9);
    }

    // ---------- interaction ----------

    pick(clientX, clientY) {
        if (!this.trench) return null;
        const rect = this.canvas.getBoundingClientRect();
        const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
        const ray = this.raycaster || (this.raycaster = new THREE.Raycaster());
        ray.setFromCamera(ndc, this.camera);
        const targets = [this.trench];
        for (const obj of this.findObjects.values()) if (obj.holder.visible && !obj.flying) targets.push(obj.holder);
        const hit = ray.intersectObjects(targets, true)[0];
        if (!hit) return null;
        if (hit.object.userData.findIndex != null) {
            const find = this.site.finds[hit.object.userData.findIndex];
            return { cell: find.cell, point: hit.point, find };
        }
        const p = hit.point.clone();
        const n = hit.face ? hit.face.normal.clone() : new THREE.Vector3(0, 1, 0);
        if (Math.abs(n.y) < 0.5) p.addScaledVector(n, 0.02);
        const i = Math.floor((p.x + HALF) / CELL), j = Math.floor((p.z + HALF) / CELL);
        if (i < 0 || j < 0 || i >= GRID || j >= GRID) return null;
        return { cell: cellIndex(i, j), point: hit.point };
    }

    rectFor(cells) {
        let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
        for (const c of cells) {
            const x = -HALF + cellX(c) * CELL, z = -HALF + cellZ(c) * CELL;
            minX = Math.min(minX, x); minZ = Math.min(minZ, z);
            maxX = Math.max(maxX, x + CELL); maxZ = Math.max(maxZ, z + CELL);
        }
        return new THREE.Vector4(minX + 0.012, minZ + 0.012, maxX - 0.012, maxZ - 0.012);
    }

    setHover(cell, tool = 'shovel', footprint = [], blocked = false) {
        const u = this.strata.userData.uniforms;
        if (cell == null || !footprint.length) {
            u.uHoverOn.value = 0;
            this.hoverFind?.(null);
            return;
        }
        u.uHover.value.copy(this.rectFor(footprint));
        u.uHoverColor.value.set(blocked ? TOOL_COLORS.blocked : TOOL_COLORS[tool]);
        u.uHoverOn.value = 1;
        const top = this.cellTop(cell);
        this.tools.setHover(top);
    }

    setCursor(cell) {
        const u = this.strata.userData.uniforms;
        this.cursorCell = cell;
        if (cell == null) { u.uCursorOn.value = 0; return; }
        u.uCursor.value.copy(this.rectFor([cell]));
        u.uCursorOn.value = 1;
        this.tools.setHover(this.cellTop(cell));
    }

    highlightFind(find) {
        for (const obj of this.findObjects.values()) {
            const on = find && obj.find === find && obj.find.state === 'exposed';
            setGlow(obj.model, on ? 0x6a4a1a : 0x000000, on ? 0.6 : 0);
        }
    }

    setTool(tool) { this.tools.setTool(tool); }

    /** Animate a tool at a unit; onImpact runs at the moment of contact. */
    act(tool, cell, onImpact) {
        const top = this.cellTop(cell);
        const tossTo = this.spoil.position.clone().add(new THREE.Vector3(0, 0.3, 0));
        return this.tools.play(tool, top, {
            tossTo,
            fast: this.reducedMotion,
            onImpact,
            onToss: pos => {
                if (tool === 'shovel') {
                    const dir = tossTo.clone().sub(pos).setY(0).normalize().multiplyScalar(1.6);
                    this.effects.clodBurst(pos, this.lastSoilColor || 0x7a5a3a, { count: 16, spread: 0.15, up: 1.4, dir, floorY: this.groundY(tossTo.x, tossTo.z) });
                }
            },
        });
    }

    // ---------- feedback ----------

    digFx(cells, tool) {
        if (!cells.length) return;
        const site = this.site;
        const center = new THREE.Vector3();
        for (const c of cells) center.add(this.cellTop(c));
        center.divideScalar(cells.length);
        const layer = Math.max(0, Math.min(LAYERS, site.depth[cells[0]] - 1));
        const color = this.soilColors[Math.min(3, layer)];
        this.lastSoilColor = color;
        const big = tool === 'shovel';
        this.effects.clodBurst(center, color, { count: big ? 18 : 7, spread: big ? CELL * 2 : CELL * 0.6, up: big ? 1.4 : 0.9, floorY: center.y });
        this.effects.dust(center, 0xd9c3a0, big ? 5 : 2, big ? 1.2 : 0.4);
        this.shake(big ? 0.06 : 0.02);
    }

    bedrockFx(cell) {
        const p = this.cellTop(cell);
        this.effects.sparkles(p, 0xfff0c0, 6, 0.15, 0.4);
        this.shake(0.03);
    }

    exposeFx(find) {
        const obj = this.findObjects.get(find.index);
        if (!obj) return;
        obj.holder.visible = true;
        obj.holder.position.y = obj.holder.userData.buriedY - 0.06;
        this.effects.tween(0.5, k => { obj.holder.position.y = obj.holder.userData.buriedY - 0.06 * (1 - k); });
        const p = this.cellTop(find.cell);
        this.effects.sparkles(p.clone().add(new THREE.Vector3(0, 0.05, 0)), 0xffe2a0, 8, 0.2, 0.5);
        this.effects.ring(p.clone().add(new THREE.Vector3(0, 0.02, 0)), 0xffe2a0, { radius: 0.45 });
    }

    damageFx(find) {
        const obj = this.findObjects.get(find.index);
        if (!obj) return;
        const p = obj.holder.position.clone();
        this.effects.clodBurst(p, 0x8f8a80, { count: 8, spread: 0.1, up: 1.1, floorY: p.y - 0.05 });
        setGlow(obj.model, 0xa02010, 0.8);
        this.effects.tween(0.6, k => setGlow(obj.model, 0xa02010, 0.8 * (1 - k)));
        this.shake(0.05);
    }

    brushFx(find, progress) {
        const obj = this.findObjects.get(find.index);
        if (!obj) return;
        const { buriedY, exposedY } = obj.holder.userData;
        const fromY = obj.holder.position.y;
        const toY = buriedY + (exposedY - buriedY) * Math.min(1, progress * 0.85);
        const soil = this.soilColors[find.layer - 1];
        const fromDirt = obj.dirt ?? 1;
        const toDirt = Math.max(0, 1 - progress);
        obj.dirt = toDirt;
        this.effects.tween(0.35, k => {
            obj.holder.position.y = fromY + (toY - fromY) * k;
            setDirt(obj.model, fromDirt + (toDirt - fromDirt) * k, soil);
        });
        const p = obj.holder.position.clone();
        this.effects.dust(p, 0xe2cfaa, 4, 0.25);
        const rank = RARITIES[find.entry.rarity].rank;
        if (progress > 0.3 && rank >= 2) this.effects.sparkles(p, RARITY_COLORS[find.entry.rarity], 3 + rank * 2, 0.2, 0.4);
    }

    /**
     * The discovery moment: the find lifts out of the ground and hangs, turning,
     * in front of a camera that moves in close. When `hold` resolves it is laid
     * on the finds tray and the camera returns to where the player left it.
     */
    recoverFx(find, { hold = null, layout = 'side' } = {}) {
        const obj = this.findObjects.get(find.index);
        if (!obj) return Promise.resolve();
        obj.flying = true;
        const { holder, model } = obj;
        holder.visible = true;
        setDirt(model, 0, 0xffffff);
        const rarity = find.entry.rarity;
        const rank = RARITIES[rarity].rank;
        const color = RARITY_COLORS[rarity];
        const start = holder.position.clone();
        const peak = start.clone().add(new THREE.Vector3(0, 0.8 + rank * 0.1, 0));
        const base = this.cellTop(find.cell);
        this.effects.beam(base, color, { height: 2 + rank * 1.2, radius: 0.25 + rank * 0.08, life: 1.6 + rank * 0.5 });
        this.effects.ring(base.clone().add(new THREE.Vector3(0, 0.03, 0)), color, { radius: 0.9 + rank * 0.3, life: 0.9 });
        this.effects.sparkles(base, color, 10 + rank * 10, 0.4, 0.9);
        if (rank >= 3) this.effects.ring(base.clone().add(new THREE.Vector3(0, 0.05, 0)), 0xffffff, { radius: 2.4, life: 1.4, width: 0.12 });
        const glow = 0.18 + rank * 0.1;
        setGlow(model, color, glow);
        const startRot = model.rotation.clone();
        const slot = this.trayIndex++;
        const trayPos = this.trayOrigin.clone().add(new THREE.Vector3(0, 0.05, -0.52 + slot * 0.26));
        const view = hold ? this.focusReveal(peak, layout) : null;

        return new Promise(resolve => {
            this.effects.tween(1.0 + rank * 0.15, k => {
                const e = 1 - Math.pow(1 - k, 3);
                holder.position.lerpVectors(start, peak, e);
                holder.scale.setScalar(1 + e * 0.35);
                model.rotation.set(startRot.x * (1 - e), startRot.y + e * Math.PI * 2, startRot.z * (1 - e));
            }, () => {
                // Hang in the air, turning, until the player has read the record.
                this.revealObj = { holder, model, y: peak.y, t: 0 };
                const minHold = new Promise(r => setTimeout(r, hold ? 0 : 500 + rank * 350));
                Promise.all([hold || Promise.resolve(), minHold]).then(() => {
                    this.revealObj = null;
                    if (view) this.endReveal(view);
                    const from = holder.position.clone();
                    const s0 = holder.scale.x;
                    this.effects.tween(0.75, k => {
                        const e = k * k * (3 - 2 * k);
                        holder.position.lerpVectors(from, trayPos, e);
                        holder.position.y += Math.sin(e * Math.PI) * 0.8;
                        holder.scale.setScalar(s0 + (0.55 - s0) * e);
                        setGlow(model, color, glow * (1 - e));
                    }, () => {
                        model.rotation.set(0, 0.3, 0);
                        const box = new THREE.Box3().setFromObject(holder);
                        holder.position.y += trayPos.y - box.min.y;
                        this.effects.dust(holder.position, 0xe2cfaa, 2, 0.1);
                        resolve();
                    });
                });
            });
        });
    }

    /** Move the camera in on a lifted find; `layout` leaves room for the record beside or below it. */
    focusReveal(point, layout) {
        const saved = { pos: this.camera.position.clone(), target: this.controls.target.clone(), min: this.controls.minDistance, enabled: this.controls.enabled };
        if (this.reducedMotion) return saved;
        this.camera.updateMatrixWorld();
        const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0).setY(0).normalize();
        const dir = this.camera.position.clone().sub(this.controls.target).normalize();
        dir.y = Math.max(dir.y * 0.7, 0.4);
        dir.normalize();
        const target = point.clone();
        if (layout === 'below') target.y -= 0.42;
        else target.addScaledVector(right, 0.62);
        const dist = layout === 'below' ? 4.1 : 3.3;
        this.controls.minDistance = 1.5;
        this.controls.enabled = false;
        this.tweenCamera(target.clone().addScaledVector(dir, dist), target, 0.95);
        return saved;
    }

    endReveal(saved) {
        this.controls.enabled = saved.enabled && this.mode === 'play';
        this.tweenCamera(saved.pos, saved.target, 0.8);
        setTimeout(() => { this.controls.minDistance = saved.min; }, 850);
    }

    plantFlag(cell, count) {
        const top = this.cellTop(cell);
        const group = new THREE.Group();
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.62, 6), new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.6 }));
        pole.position.y = 0.31;
        group.add(pole);
        const c = document.createElement('canvas');
        c.width = 128; c.height = 96;
        const ctx = c.getContext('2d');
        const colors = ['#8d877b', '#e0a23a', '#e0663f', '#d1452c', '#b12c22', '#8f1d18'];
        ctx.fillStyle = colors[Math.min(count, colors.length - 1)];
        ctx.fillRect(0, 0, 128, 96);
        ctx.fillStyle = '#fffaf0';
        ctx.font = '700 70px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(count), 64, 52);
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.2), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.8 }));
        flag.position.set(0.13, 0.52, 0);
        group.add(flag);
        group.traverse(o => { if (o.isMesh) o.castShadow = true; });
        group.position.copy(top);
        group.userData.flag = flag;
        this.scene.add(group);
        this.flags.set(cell, group);
        // drop-in
        this.effects.tween(0.35, k => { group.position.y = top.y + (1 - k) * 0.6; group.scale.setScalar(0.6 + 0.4 * k); });
        this.effects.ring(top.clone().add(new THREE.Vector3(0, 0.02, 0)), count > 0 ? 0x8fb0f0 : 0xb0a890, { radius: CELL * 1.6, life: 0.9 });
    }

    shake(amount) {
        if (!this.shakeEnabled || this.reducedMotion) return;
        this.shakeAmount = Math.min(0.12, this.shakeAmount + amount);
    }

    // ---------- camera ----------

    setMode(mode) {
        this.mode = mode;
        this.controls.enabled = mode === 'play';
        this.tools.setVisible(mode === 'play');
        if (mode === 'play') this.resetView(false);
    }

    /** Default framing: pulled back (and more overhead) on narrow screens so the whole grid fits. */
    homePosition() {
        const aspect = innerWidth / innerHeight;
        const vfov = THREE.MathUtils.degToRad(this.camera.fov);
        const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
        const fit = 3.4 / Math.tan(hfov / 2) + 1.2;
        const dist = Math.max(10.1, fit);
        const dir = aspect < 0.8 ? new THREE.Vector3(0, 0.86, 0.51) : new THREE.Vector3(0, 0.682, 0.731);
        this.controls.maxDistance = Math.max(13, dist * 1.25);
        return dir.normalize().multiplyScalar(dist);
    }

    resetView(animate = true) {
        const target = new THREE.Vector3(0, -0.15, 0);
        const pos = this.homePosition().add(target);
        if (!animate || this.reducedMotion) {
            this.camera.position.copy(pos);
            this.controls.target.copy(target);
            this.controls.update();
            return;
        }
        this.tweenCamera(pos, target, 0.7);
    }

    focusCell(cell) {
        const top = this.cellTop(cell);
        const dir = this.camera.position.clone().sub(this.controls.target).normalize();
        const target = new THREE.Vector3(top.x * 0.6, -0.15, top.z * 0.6);
        this.tweenCamera(target.clone().addScaledVector(dir, 6.2), target, 0.6);
    }

    rotateView(angle) {
        const t = this.controls.target;
        const offset = this.camera.position.clone().sub(t);
        offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
        this.tweenCamera(t.clone().add(offset), t.clone(), 0.45);
    }

    tweenCamera(pos, target, dur) {
        if (this.reducedMotion) { this.camera.position.copy(pos); this.controls.target.copy(target); return; }
        const p0 = this.camera.position.clone(), t0 = this.controls.target.clone();
        this.focusTween?.();
        this.focusTween = this.effects.tween(dur, k => {
            const e = k * k * (3 - 2 * k);
            this.camera.position.lerpVectors(p0, pos, e);
            this.controls.target.lerpVectors(t0, target, e);
        });
    }

    // ---------- loop ----------

    resize() {
        this.camera.aspect = innerWidth / innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(innerWidth, innerHeight, false);
        if (this.mode === 'play') this.controls.maxDistance = Math.max(13, this.homePosition().length() * 1.25);
    }

    frame() {
        const dt = Math.min(0.05, this.clock.getDelta());
        const time = this.clock.elapsedTime;
        this.strata.userData.uniforms.uTime.value = time;
        this.sky.material.uniforms.uTime.value = time;
        this.sky.position.copy(this.camera.position);

        if (this.mode === 'menu') {
            this.menuAngle += dt * (this.reducedMotion ? 0 : 0.045);
            const r = innerWidth / innerHeight < 0.8 ? 13 : 10.5;
            this.camera.position.set(Math.sin(this.menuAngle) * r, 4.6, Math.cos(this.menuAngle) * r);
            this.camera.lookAt(-0.6, -0.3, 0);
        } else {
            this.controls.update();
        }

        if (this.shakeAmount > 0.0005) {
            const s = this.shakeAmount;
            this.camera.position.add(new THREE.Vector3((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s));
            this.shakeAmount *= Math.pow(0.0008, dt);
        }

        for (const l of this.lanterns) {
            const f = Math.sin(time * 9 + l.seed) * 0.25 + Math.sin(time * 23 + l.seed * 3) * 0.15;
            l.light.intensity = l.base * (1 + f * 0.25);
        }
        if (this.revealObj) {
            const r = this.revealObj;
            r.t += dt;
            r.holder.position.y = r.y + Math.sin(r.t * 1.6) * 0.035;
            r.model.rotation.y += dt * 0.7;
        }
        // exposed finds glint gently
        for (const obj of this.findObjects.values()) {
            if (obj.find.state === 'exposed' && !obj.flying && Math.random() < dt * 0.6) {
                this.effects.sparkles(obj.holder.position.clone().add(new THREE.Vector3(0, 0.08, 0)), 0xffe8b0, 1, 0.12, 0.3);
            }
        }

        this.tools.update(dt);
        this.effects.update(dt, time);
        this.renderer.render(this.scene, this.camera);
    }
}
