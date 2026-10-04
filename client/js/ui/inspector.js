// ============================================
// INSPECTOR — 3D turntable + catalogue card for a single artifact.
// ============================================

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { $, h, clear, icon, fmtInt, dialogs } from './dom.js';
import { RARITIES, MATERIALS, formatAge, formatYear, estimateValue, materialLabel } from '../data/catalog.js';
import { CONDITIONS, LAYER_NAMES, cellLabel, displayName } from '../game/site.js';
import { buildArtifact, disposeObject } from '../game/artifactModels.js';
import { catalogNumber, fieldNumber } from './catalogue.js';
import { findDepth } from './reveal.js';

let stage = null;

async function getStage() {
    if (stage) return stage;
    const host = $('#insp-stage');
    const canvas = document.createElement('canvas');
    host.prepend(canvas);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xfff0dc, 0x2a1d12, 1.2));
    const key = new THREE.SpotLight(0xffe2b0, 30, 12, 0.6, 0.6, 1.6);
    key.position.set(1.6, 3.2, 2);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffb060, 1.6);
    rim.position.set(-2, 1.4, -2.2);
    scene.add(rim);
    // museum plinth
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.68, 0.16, 48), new THREE.MeshStandardMaterial({ color: 0x2a211a, roughness: 0.55, metalness: 0.1 }));
    plinth.position.y = -0.58;
    plinth.receiveShadow = true;
    scene.add(plinth);
    const trim = new THREE.Mesh(new THREE.TorusGeometry(0.625, 0.012, 8, 64), new THREE.MeshStandardMaterial({ color: 0xd6a446, metalness: 1, roughness: 0.3, envMap: env }));
    trim.rotation.x = Math.PI / 2;
    trim.position.y = -0.5;
    scene.add(trim);

    const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 30);
    camera.position.set(0, 0.35, 3.8);
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 1.6;
    controls.maxDistance = 4.5;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.6;
    controls.target.set(0, 0, 0);
    canvas.addEventListener('pointerdown', () => { controls.autoRotate = false; });

    const resize = () => {
        const w = host.clientWidth, hgt = host.clientHeight;
        if (!w || !hgt) return;
        renderer.setSize(w, hgt, false);
        camera.aspect = w / hgt;
        camera.updateProjectionMatrix();
    };
    new ResizeObserver(resize).observe(host);
    stage = { renderer, scene, camera, controls, env, resize, model: null };
    return stage;
}

function fact(k, v) {
    return [h('dt', k), h('dd', v)];
}

/**
 * @param {object} entry   catalog entry
 * @param {object} opts
 *   find      in-round find object (condition, cell, layer)
 *   revealed  show culture / period / history
 *   condition condition index (archive best)
 *   isNew
 */
export async function openInspector(entry, { find = null, revealed = false, condition = null, isNew = false, onClose } = {}) {
    const cond = find ? find.condition : condition;
    const onSite = find && !revealed;
    const name = onSite ? displayName(find) : entry.name;
    $('#insp-catno').textContent = onSite ? fieldNumber(find) : catalogNumber(entry);
    const r = $('#insp-rarity');
    r.className = `rarity rarity-${entry.rarity}`;
    r.textContent = RARITIES[entry.rarity].label + (isNew ? ' · New to your archive' : '');
    $('#insp-name').textContent = name;

    const facts = clear($('#insp-facts'));
    facts.append(...fact('Material', materialLabel(entry)));
    facts.append(...fact('Age', formatAge(entry.year)));
    if (revealed) facts.append(...fact('Dated', formatYear(entry.year)));
    if (cond != null) facts.append(...fact('Condition', CONDITIONS[cond].label));
    facts.append(...fact('Est. value', fmtInt(estimateValue(entry, cond != null ? CONDITIONS[cond].factor : 1))));
    if (find) facts.append(...fact('Found', `Unit ${cellLabel(find.cell)} · ${LAYER_NAMES[find.layer - 1]}`));
    if (find) facts.append(...fact('Depth', `${findDepth(find.layer).toFixed(2)} m`));
    if (revealed) {
        facts.append(...fact('Culture', entry.culture));
        facts.append(...fact('Period', entry.period));
        facts.append(...fact('Origin', entry.country));
    }

    const notes = clear($('#insp-notes'));
    if (revealed) {
        notes.append(h('p.history', entry.note));
        const q = encodeURIComponent(`${entry.name} ${entry.culture}`);
        notes.append(h('p.ext-link', 'Compare similar objects in ',
            h('a', { href: `https://www.metmuseum.org/art/collection/search?q=${q}`, target: '_blank', rel: 'noopener' }, 'The Met collection'),
            '.'));
    } else {
        notes.append(h('div.pending', icon('info'),
            h('span', 'Sealed until the site is identified — culture, period and history are added to this entry after your guess.')));
    }

    dialogs.open('inspector', {
        onClose: () => {
            if (stage) stage.renderer.setAnimationLoop(null);
            onClose?.();
        },
    });

    try {
        const s = await getStage();
        if (s.model) { s.scene.remove(s.model); disposeObject(s.model); }
        s.model = buildArtifact(entry, { envMap: s.env, target: 1 });
        s.model.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
        s.model.position.y = 0;
        // rest the object on the plinth
        const box = new THREE.Box3().setFromObject(s.model);
        s.model.position.y = -0.5 - box.min.y + 0.01;
        s.scene.add(s.model);
        s.controls.target.set(0, s.model.position.y + (box.max.y - box.min.y) / 2, 0);
        s.controls.autoRotate = true;
        s.resize();
        s.camera.position.set(0, s.controls.target.y + 0.45, s.camera.aspect < 1 ? 4.6 : 3.8);
        s.renderer.setAnimationLoop(() => {
            s.controls.update();
            s.renderer.render(s.scene, s.camera);
        });
    } catch (e) {
        console.warn('[Inspector] 3D view unavailable', e);
    }
}

