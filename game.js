import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { modelLoader } from './modelLoader.js';
import { audioManager } from './audioManager.js';
import { initMenuSystem, submitMultiplayerGuess, isMultiplayerGame, showGameOver } from './menuController.js';
import { artifactService } from './artifactService.js';
import { tutorial } from './tutorial.js';


// ============================================
// GAME CONFIGURATION
// ============================================

const COUNTRIES = [
    {
        name: 'Egypt',
        terrain: {
            color: 0xd4a574,
            roughness: 0.9,
            type: 'sand'
        }
    },
    {
        name: 'Greece',
        terrain: {
            color: 0x8b7355,
            roughness: 0.8,
            type: 'dirt'
        }
    },
    {
        name: 'China',
        terrain: {
            color: 0x654321,
            roughness: 0.7,
            type: 'soil'
        }
    },
    {
        name: 'Mexico',
        terrain: {
            color: 0xc2b280,
            roughness: 0.85,
            type: 'sand'
        }
    },
    {
        name: 'Japan',
        terrain: {
            color: 0x3d2817,
            roughness: 0.6,
            type: 'soil'
        }
    },
    {
        name: 'Rome',
        terrain: {
            color: 0x9b7653,
            roughness: 0.75,
            type: 'dirt'
        }
    },
    {
        name: 'India',
        terrain: {
            color: 0xb5651d,
            roughness: 0.7,
            type: 'soil'
        }
    },
    {
        name: 'Peru',
        terrain: {
            color: 0xa0826d,
            roughness: 0.85,
            type: 'sand'
        }
    },
    {
        name: 'Mesopotamia',
        terrain: {
            color: 0xc4a35a,
            roughness: 0.9,
            type: 'sand'
        }
    }
];

const ALL_COUNTRIES = [
    'Afghanistan', 'Albania', 'Algeria', 'Argentina', 'Australia', 'Austria',
    'Belgium', 'Brazil', 'Cambodia', 'Canada', 'Chile', 'China', 'Colombia',
    'Croatia', 'Cuba', 'Czech Republic', 'Denmark', 'Egypt', 'Ethiopia',
    'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Iceland', 'India',
    'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy', 'Japan',
    'Jordan', 'Kenya', 'South Korea', 'Mexico', 'Morocco', 'Netherlands',
    'New Zealand', 'Nigeria', 'Norway', 'Pakistan', 'Peru', 'Philippines',
    'Poland', 'Portugal', 'Romania', 'Russia', 'Saudi Arabia', 'Singapore',
    'South Africa', 'Spain', 'Sweden', 'Switzerland', 'Thailand', 'Turkey',
    'Ukraine', 'United Kingdom', 'United States', 'Vietnam'
];

// Platform settings
const PLATFORM_SIZE = 5;
const PLATFORM_SEGMENTS = 25;
const DIG_RADIUS = 0.5;
const DIG_DEPTH = 0.2;
const MAX_DIG_DEPTH = 1.5;

// ============================================
// GAME STATE
// ============================================

let scene, camera, renderer, controls;
let digPlatform, digHeights;
let currentCountry = null;
let artifactsFound = 0;
let totalArtifacts = 5;
let score = 0;
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let artifacts = [];
let lobbyObjects = [];

// Shovel
let shovel = null;
let isShovelAnimating = false;

// Debug
let wallhackMarkers = [];
let wallhackEnabled = false;
let digTargetPoint = null;

// Multiplayer & Game Settings
let gameSettings = {
    rounds: 10,
    timePerRound: 120,
    isMultiplayer: false
};
let currentRound = 0;
let totalRounds = 10;
let correctGuesses = 0;
let totalGuesses = 0;
let totalArtifactsFoundGame = 0;
let roundTimer = null;
let timeRemaining = 0;
let hasGuessedThisRound = false;

// ============================================
// THREE.JS SETUP
// ============================================

async function init() {
    const canvas = document.getElementById('canvas');

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x3a3a3a);

    // Camera
    camera = new THREE.PerspectiveCamera(
        50,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(0, 6, 8);
    camera.lookAt(0, 1, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    // Controls - RIGHT MOUSE for orbit
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.minPolarAngle = Math.PI / 6;
    controls.minDistance = 3;
    controls.maxDistance = 15;
    controls.target.set(0, 1, 0);
    controls.mouseButtons = {
        LEFT: null, // Disable left mouse for orbit
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.ROTATE
    };

    // Create lobby environment
    createArchaeologyRoom();

    // Lighting
    setupLighting();

    // Load shovel
    await loadShovel();

    // Event listeners
    window.addEventListener('resize', onWindowResize);
    canvas.addEventListener('click', onCanvasClick);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('mousemove', onCanvasMouseMove);

    // UI Events
    setupUI();

    // Preload models (keeping for shovel/fallback, artifacts come from API)
    document.getElementById('loading').textContent = 'Preparing artifacts...';
    // await modelLoader.preloadAll(); // Not used atm.

    // Preload audio
    document.getElementById('loading').textContent = 'Loading sounds...';
    await audioManager.preload();

    // Hide loading
    document.getElementById('loading').style.display = 'none';

    // Initialize menu system with callback
    initMenuSystem((settings) => {
        gameSettings = settings;
        totalRounds = settings.rounds;
        currentRound = 0;
        correctGuesses = 0;
        totalGuesses = 0;
        totalArtifactsFoundGame = 0;
        score = 0;
        document.getElementById('score-value').textContent = '0';

        // Start game
        startNewRound();
    });

    // DON'T auto-start the game - wait for menu selection

    // Animation loop
    animate();
}

async function loadShovel() {
    try {
        const loader = new GLTFLoader();
        const gltf = await loader.loadAsync('./public/models/low_poly_wooden_shovel.glb');
        const shovelModel = gltf.scene;

        // Normalize shovel size
        const box = new THREE.Box3().setFromObject(shovelModel);
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 1.5 / maxDim;
        shovelModel.scale.setScalar(scale);

        // Center the model
        box.setFromObject(shovelModel);
        const center = new THREE.Vector3();
        box.getCenter(center);
        shovelModel.position.sub(center);

        // Create a pivot group to correct the model's orientation
        // Rotate the model inside so blade points in -Y direction when wrapper has no rotation
        const pivotGroup = new THREE.Group();
        shovelModel.rotation.set(Math.PI, 0, 0); // Flip so blade is down
        pivotGroup.add(shovelModel);

        // Main wrapper for animation control
        shovel = new THREE.Group();
        shovel.add(pivotGroup);

        // Enable shadows
        shovel.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        // Initial position (off to the side, resting)
        shovel.position.set(4, 1.0, 4);
        shovel.rotation.set(0.3, -Math.PI / 4, 0.2);
        scene.add(shovel);

        console.log('Shovel loaded successfully');
    } catch (error) {
        console.warn('Could not load shovel model:', error);
        // Create fallback shovel
        shovel = createFallbackShovel();
        scene.add(shovel);
    }
}

function createFallbackShovel() {
    const group = new THREE.Group();

    // Handle
    const handleGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.2, 8);
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.position.y = 0.6;
    group.add(handle);

    // Blade
    const bladeGeo = new THREE.BoxGeometry(0.3, 0.02, 0.35);
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.7 });
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.y = -0.02;
    group.add(blade);

    group.castShadow = true;
    return group;
}

function setupLighting() {
    function setupLighting() {
        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambient);

        const hemiLight = new THREE.HemisphereLight(0xfff8e8, 0x8b7355, 0.5);
        hemiLight.position.set(0, 10, 0);
        scene.add(hemiLight);

        const mainLight = new THREE.DirectionalLight(0xffffff, 1.0);
        mainLight.position.set(2, 3, 4);
        scene.add(mainLight);

        const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
        fillLight.position.set(-2, 1, 2);
        scene.add(fillLight);

        const rimLight = new THREE.DirectionalLight(0xffffff, 0.3);
        rimLight.position.set(-1, 2, -3);
        scene.add(rimLight);
    }

    // Main ceiling lights - brighter
    const ceilingLight1 = new THREE.SpotLight(0xfff5e6, 5);
    ceilingLight1.position.set(-3, 6, -3);
    ceilingLight1.angle = Math.PI / 2.5;
    ceilingLight1.penumbra = 0.6;
    ceilingLight1.decay = 1;
    ceilingLight1.castShadow = true;
    ceilingLight1.shadow.mapSize.width = 1024;
    ceilingLight1.shadow.mapSize.height = 1024;
    scene.add(ceilingLight1);

    const ceilingLight2 = new THREE.SpotLight(0xfff5e6, 5);
    ceilingLight2.position.set(3, 6, -3);
    ceilingLight2.angle = Math.PI / 2.5;
    ceilingLight2.penumbra = 0.6;
    ceilingLight2.decay = 1;
    ceilingLight2.castShadow = true;
    scene.add(ceilingLight2);

    // Additional ceiling lights for back of room
    const ceilingLight3 = new THREE.SpotLight(0xfff5e6, 4);
    ceilingLight3.position.set(-3, 6, 3);
    ceilingLight3.angle = Math.PI / 2.5;
    ceilingLight3.penumbra = 0.6;
    ceilingLight3.decay = 1;
    scene.add(ceilingLight3);

    const ceilingLight4 = new THREE.SpotLight(0xfff5e6, 4);
    ceilingLight4.position.set(3, 6, 3);
    ceilingLight4.angle = Math.PI / 2.5;
    ceilingLight4.penumbra = 0.6;
    ceilingLight4.decay = 1;
    scene.add(ceilingLight4);

    // Spotlight on dig platform - nice and bright
    const digLight = new THREE.SpotLight(0xffffff, 6);
    digLight.position.set(0, 5, 0);
    digLight.angle = Math.PI / 3;
    digLight.penumbra = 0.4;
    digLight.decay = 0.8;
    digLight.castShadow = true;
    digLight.shadow.mapSize.width = 2048;
    digLight.shadow.mapSize.height = 2048;
    digLight.target.position.set(0, 0, 0);
    scene.add(digLight);
    scene.add(digLight.target);

    // Display case accent lights - warmer and brighter
    const accentColor = 0xffd700;
    const accent1 = new THREE.PointLight(accentColor, 1.5, 8);
    accent1.position.set(-6, 2, -4);
    scene.add(accent1);

    const accent2 = new THREE.PointLight(accentColor, 1.5, 8);
    accent2.position.set(6, 2, -4);
    scene.add(accent2);

    // Wall wash lights
    const wallLight1 = new THREE.PointLight(0xfff0e0, 1, 10);
    wallLight1.position.set(-8, 3, 0);
    scene.add(wallLight1);

    const wallLight2 = new THREE.PointLight(0xfff0e0, 1, 10);
    wallLight2.position.set(8, 3, 0);
    scene.add(wallLight2);
}

// ============================================
// ARCHAEOLOGY ROOM
// ============================================

function createArchaeologyRoom() {
    // Floor - wooden parquet
    createFloor();

    // Walls
    createWalls();

    // Ceiling
    createCeiling();

    // Dig platform with barrier
    createPlatformArea();

    // Display cases
    createDisplayCases();

    // Wall decorations
    createWallDecorations();

    // Furniture
    createFurniture();
}

function createFloor() {
    const floorGeo = new THREE.PlaneGeometry(20, 20);
    const floorMat = new THREE.MeshStandardMaterial({
        color: 0x3d2817,
        roughness: 0.8,
        metalness: 0.1
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.5;
    floor.receiveShadow = true;
    scene.add(floor);
    lobbyObjects.push(floor);

    // Floor pattern (planks)
    for (let i = -9; i <= 9; i += 1) {
        const lineGeo = new THREE.BoxGeometry(20, 0.01, 0.02);
        const lineMat = new THREE.MeshStandardMaterial({ color: 0x2a1a0a });
        const line = new THREE.Mesh(lineGeo, lineMat);
        line.position.set(0, -0.49, i);
        scene.add(line);
        lobbyObjects.push(line);
    }
}

function createWalls() {
    const wallMat = new THREE.MeshStandardMaterial({
        color: 0x5a5a5a,
        roughness: 0.85
    });

    // Back wall
    const backWallGeo = new THREE.PlaneGeometry(20, 7);
    const backWall = new THREE.Mesh(backWallGeo, wallMat);
    backWall.position.set(0, 3, -10);
    backWall.receiveShadow = true;
    scene.add(backWall);
    lobbyObjects.push(backWall);

    // Side walls
    const sideWallGeo = new THREE.PlaneGeometry(20, 7);

    const leftWall = new THREE.Mesh(sideWallGeo, wallMat);
    leftWall.position.set(-10, 3, 0);
    leftWall.rotation.y = Math.PI / 2;
    scene.add(leftWall);
    lobbyObjects.push(leftWall);

    const rightWall = new THREE.Mesh(sideWallGeo, wallMat);
    rightWall.position.set(10, 3, 0);
    rightWall.rotation.y = -Math.PI / 2;
    scene.add(rightWall);
    lobbyObjects.push(rightWall);

    // Wainscoting (lower wall panels)
    const wainscotMat = new THREE.MeshStandardMaterial({ color: 0x3d2817 });

    const wainscotBack = new THREE.Mesh(
        new THREE.BoxGeometry(20, 1.5, 0.1),
        wainscotMat
    );
    wainscotBack.position.set(0, 0.25, -9.9);
    scene.add(wainscotBack);
    lobbyObjects.push(wainscotBack);
}

function createCeiling() {
    const ceilingGeo = new THREE.PlaneGeometry(20, 20);
    const ceilingMat = new THREE.MeshStandardMaterial({
        color: 0x4a4a4a,
        roughness: 0.9
    });
    const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = 6.5;
    scene.add(ceiling);
    lobbyObjects.push(ceiling);

    // Ceiling beams - warmer wood tone
    const beamMat = new THREE.MeshStandardMaterial({ color: 0x5c4030 });
    for (let i = -6; i <= 6; i += 4) {
        const beam = new THREE.Mesh(
            new THREE.BoxGeometry(20, 0.3, 0.4),
            beamMat
        );
        beam.position.set(0, 6.3, i);
        scene.add(beam);
        lobbyObjects.push(beam);
    }
}

function createPlatformArea() {
    const frameSize = PLATFORM_SIZE + 0.6;

    // Stone platform base
    const baseGeo = new THREE.BoxGeometry(frameSize + 0.4, 0.3, frameSize + 0.4);
    const baseMat = new THREE.MeshStandardMaterial({
        color: 0x4a4a4a,
        roughness: 0.9
    });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = -0.35;
    base.receiveShadow = true;
    base.castShadow = true;
    scene.add(base);
    lobbyObjects.push(base);

    // Wooden frame around dig area
    const frameMat = new THREE.MeshStandardMaterial({
        color: 0x5c4030,
        roughness: 0.7
    });
    const frameHeight = 0.25;

    const sides = [
        { pos: [0, 0, frameSize/2], size: [frameSize + 0.3, frameHeight, 0.15] },
        { pos: [0, 0, -frameSize/2], size: [frameSize + 0.3, frameHeight, 0.15] },
        { pos: [frameSize/2, 0, 0], size: [0.15, frameHeight, frameSize] },
        { pos: [-frameSize/2, 0, 0], size: [0.15, frameHeight, frameSize] }
    ];

    sides.forEach(side => {
        const geo = new THREE.BoxGeometry(...side.size);
        const mesh = new THREE.Mesh(geo, frameMat);
        mesh.position.set(...side.pos);
        mesh.position.y = -0.07;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        lobbyObjects.push(mesh);
    });

    // Rope barriers
    createRopeBarrier();

    // Info plaque
    const plaqueGeo = new THREE.BoxGeometry(1.2, 0.6, 0.05);
    const plaqueMat = new THREE.MeshStandardMaterial({
        color: 0xc9a227,
        metalness: 0.8,
        roughness: 0.3
    });
    const plaque = new THREE.Mesh(plaqueGeo, plaqueMat);
    plaque.position.set(0, 0.3, frameSize/2 + 0.5);
    plaque.rotation.x = -Math.PI / 6;
    scene.add(plaque);
    lobbyObjects.push(plaque);
}

function createRopeBarrier() {
    const postMat = new THREE.MeshStandardMaterial({
        color: 0xc9a227,
        metalness: 0.7,
        roughness: 0.3
    });
    const ropeMat = new THREE.MeshStandardMaterial({
        color: 0x8b0000,
        roughness: 0.8
    });

    const postPositions = [
        [-4, 4], [4, 4], [-4, -4], [4, -4]
    ];

    postPositions.forEach(([x, z]) => {
        // Post
        const postGeo = new THREE.CylinderGeometry(0.05, 0.07, 1, 16);
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(x, 0, z);
        post.castShadow = true;
        scene.add(post);
        lobbyObjects.push(post);

        // Top ball
        const ballGeo = new THREE.SphereGeometry(0.08, 16, 16);
        const ball = new THREE.Mesh(ballGeo, postMat);
        ball.position.set(x, 0.55, z);
        scene.add(ball);
        lobbyObjects.push(ball);
    });

    // Ropes
    const ropeConnections = [
        [[-4, 4], [4, 4]],
        [[-4, -4], [4, -4]],
        [[-4, 4], [-4, -4]],
        [[4, 4], [4, -4]]
    ];

    ropeConnections.forEach(([start, end]) => {
        const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(start[0], 0.4, start[1]),
            new THREE.Vector3((start[0] + end[0]) / 2, 0.25, (start[1] + end[1]) / 2),
            new THREE.Vector3(end[0], 0.4, end[1])
        ]);

        const ropeGeo = new THREE.TubeGeometry(curve, 20, 0.02, 8, false);
        const rope = new THREE.Mesh(ropeGeo, ropeMat);
        scene.add(rope);
        lobbyObjects.push(rope);
    });
}

function createDisplayCases() {
    const caseMat = new THREE.MeshStandardMaterial({
        color: 0x2a1a0a,
        roughness: 0.5
    });
    const glassMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.15,
        roughness: 0.1,
        metalness: 0.1
    });

    // Left display case
    createDisplayCase(-6, -5, caseMat, glassMat);

    // Right display case
    createDisplayCase(6, -5, caseMat, glassMat);

    // Back wall display shelves
    createWallShelves();
}

function createDisplayCase(x, z, caseMat, glassMat) {
    const group = new THREE.Group();

    // Base
    const base = new THREE.Mesh(
        new THREE.BoxGeometry(2, 0.8, 1),
        caseMat
    );
    base.position.y = 0.4;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    // Glass top
    const glass = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 0.6, 0.9),
        glassMat
    );
    glass.position.y = 1.1;
    group.add(glass);

    // Display items (decorative)
    const itemGeo = new THREE.DodecahedronGeometry(0.15);
    const itemMat = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        metalness: 0.8
    });
    const item = new THREE.Mesh(itemGeo, itemMat);
    item.position.y = 0.95;
    item.castShadow = true;
    group.add(item);

    group.position.set(x, -0.5, z);
    scene.add(group);
    lobbyObjects.push(group);
}

function createWallShelves() {
    const shelfMat = new THREE.MeshStandardMaterial({ color: 0x3d2817 });

    // Create shelves on back wall
    for (let i = 0; i < 3; i++) {
        const shelf = new THREE.Mesh(
            new THREE.BoxGeometry(2.5, 0.1, 0.4),
            shelfMat
        );
        shelf.position.set(-5 + i * 5, 2.5, -9.7);
        shelf.castShadow = true;
        shelf.receiveShadow = true;
        scene.add(shelf);
        lobbyObjects.push(shelf);

        // Items on shelf
        for (let j = 0; j < 3; j++) {
            const itemTypes = [
                () => new THREE.CylinderGeometry(0.08, 0.1, 0.25, 8),
                () => new THREE.BoxGeometry(0.15, 0.2, 0.1),
                () => new THREE.SphereGeometry(0.1, 8, 8)
            ];
            const itemGeo = itemTypes[j]();
            const itemMat = new THREE.MeshStandardMaterial({
                color: [0xcd853f, 0x8b7355, 0x696969][j]
            });
            const item = new THREE.Mesh(itemGeo, itemMat);
            item.position.set(-5.8 + i * 5 + j * 0.6, 2.7, -9.5);
            item.castShadow = true;
            scene.add(item);
            lobbyObjects.push(item);
        }
    }
}

function createWallDecorations() {
    // World map on back wall - frame first, then map in front
    const frameGeo = new THREE.BoxGeometry(4.2, 2.7, 0.1);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x3d2817 });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.set(0, 3.5, -9.9);
    scene.add(frame);
    lobbyObjects.push(frame);

    // Map sits on top of frame
    const mapGeo = new THREE.PlaneGeometry(4, 2.5);
    const mapMat = new THREE.MeshStandardMaterial({
        color: 0xd4b896,
        roughness: 0.9
    });
    const map = new THREE.Mesh(mapGeo, mapMat);
    map.position.set(0, 3.5, -9.84);
    scene.add(map);
    lobbyObjects.push(map);

    // Side wall pictures
    const picPositions = [
        { pos: [-9.9, 3, -3], rot: Math.PI / 2 },
        { pos: [-9.9, 3, 3], rot: Math.PI / 2 },
        { pos: [9.9, 3, -3], rot: -Math.PI / 2 },
        { pos: [9.9, 3, 3], rot: -Math.PI / 2 }
    ];

    picPositions.forEach(({ pos, rot }) => {
        // Frame first
        const picFrame = new THREE.Mesh(
            new THREE.BoxGeometry(1.7, 1.4, 0.08),
            new THREE.MeshStandardMaterial({ color: 0xc9a227 })
        );
        picFrame.position.set(...pos);
        picFrame.rotation.y = rot;
        scene.add(picFrame);
        lobbyObjects.push(picFrame);

        // Picture on top of frame
        const picGeo = new THREE.PlaneGeometry(1.5, 1.2);
        const picMat = new THREE.MeshStandardMaterial({ color: 0x4a3020 });
        const pic = new THREE.Mesh(picGeo, picMat);
        const offset = rot > 0 ? 0.05 : -0.05;
        pic.position.set(pos[0] + offset, pos[1], pos[2]);
        pic.rotation.y = rot;
        scene.add(pic);
        lobbyObjects.push(pic);
    });
}

function createFurniture() {
    // Work desk on the side
    const deskMat = new THREE.MeshStandardMaterial({ color: 0x3d2817 });

    const deskTop = new THREE.Mesh(
        new THREE.BoxGeometry(2, 0.1, 1),
        deskMat
    );
    deskTop.position.set(-7, 0.3, 2);
    deskTop.castShadow = true;
    deskTop.receiveShadow = true;
    scene.add(deskTop);
    lobbyObjects.push(deskTop);

    // Desk legs
    const legGeo = new THREE.BoxGeometry(0.1, 0.8, 0.1);
    const legPositions = [[-7.9, 1.6], [-7.9, 2.4], [-6.1, 1.6], [-6.1, 2.4]];
    legPositions.forEach(([x, z]) => {
        const leg = new THREE.Mesh(legGeo, deskMat);
        leg.position.set(x, -0.1, z);
        scene.add(leg);
        lobbyObjects.push(leg);
    });

    // Items on desk
    const lampBase = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.12, 0.05, 16),
        new THREE.MeshStandardMaterial({ color: 0x333333 })
    );
    lampBase.position.set(-7.5, 0.38, 2.2);
    scene.add(lampBase);
    lobbyObjects.push(lampBase);

    const lampArm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8),
        new THREE.MeshStandardMaterial({ color: 0x444444 })
    );
    lampArm.position.set(-7.5, 0.63, 2.2);
    scene.add(lampArm);
    lobbyObjects.push(lampArm);

    // Book stack
    const bookColors = [0x8b0000, 0x006400, 0x00008b];
    bookColors.forEach((color, i) => {
        const book = new THREE.Mesh(
            new THREE.BoxGeometry(0.25, 0.05, 0.18),
            new THREE.MeshStandardMaterial({ color })
        );
        book.position.set(-6.5, 0.38 + i * 0.05, 2.3);
        book.rotation.y = Math.random() * 0.2;
        scene.add(book);
        lobbyObjects.push(book);
    });

    // Chair
    const chairMat = new THREE.MeshStandardMaterial({ color: 0x2a1a0a });
    const chairSeat = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.05, 0.5),
        chairMat
    );
    chairSeat.position.set(-7, 0, 3);
    scene.add(chairSeat);
    lobbyObjects.push(chairSeat);

    const chairBack = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.6, 0.05),
        chairMat
    );
    chairBack.position.set(-7, 0.3, 3.22);
    scene.add(chairBack);
    lobbyObjects.push(chairBack);
}

// ============================================
// DIG PLATFORM
// ============================================

// Store terrain sides for cleanup
let terrainSides = [];
let terrainBase = null;

// Simple seeded random for consistent terrain
function seededRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

// Simple noise function (like Perlin but simpler)
function noise2D(x, y, seed) {
    const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
    return n - Math.floor(n);
}

// Smooth noise with interpolation
function smoothNoise(x, y, seed) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = x0 + 1;
    const y1 = y0 + 1;

    const sx = x - x0;
    const sy = y - y0;

    // Smooth interpolation
    const smoothX = sx * sx * (3 - 2 * sx);
    const smoothY = sy * sy * (3 - 2 * sy);

    const n00 = noise2D(x0, y0, seed);
    const n10 = noise2D(x1, y0, seed);
    const n01 = noise2D(x0, y1, seed);
    const n11 = noise2D(x1, y1, seed);

    const nx0 = n00 * (1 - smoothX) + n10 * smoothX;
    const nx1 = n01 * (1 - smoothX) + n11 * smoothX;

    return nx0 * (1 - smoothY) + nx1 * smoothY;
}

// Multi-octave noise for more natural terrain
function terrainNoise(x, y, seed) {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;

    // 3 octaves of noise
    for (let i = 0; i < 3; i++) {
        value += smoothNoise(x * frequency, y * frequency, seed + i * 100) * amplitude;
        maxValue += amplitude;
        amplitude *= 0.5;
        frequency *= 2;
    }

    return value / maxValue;
}

function createDigPlatform(country) {
    // Clean up old platform
    if (digPlatform) {
        scene.remove(digPlatform);
        digPlatform.geometry.dispose();
        digPlatform.material.dispose();
    }

    // Clean up old sides and base
    terrainSides.forEach(side => {
        scene.remove(side);
        if (side.geometry) side.geometry.dispose();
        if (side.material) side.material.dispose();
    });
    terrainSides = [];

    if (terrainBase) {
        scene.remove(terrainBase);
        if (terrainBase.geometry) terrainBase.geometry.dispose();
        if (terrainBase.material) terrainBase.material.dispose();
        terrainBase = null;
    }

    // Generate a random seed for this terrain
    const terrainSeed = Math.random() * 10000;

    // Base terrain height and variation
    const TERRAIN_HEIGHT = 1.0;
    const HEIGHT_VARIATION = 0.6;

    digHeights = new Float32Array((PLATFORM_SEGMENTS + 1) * (PLATFORM_SEGMENTS + 1));

    // Create the top diggable surface with noise-based height
    const geometry = new THREE.PlaneGeometry(
        PLATFORM_SIZE,
        PLATFORM_SIZE,
        PLATFORM_SEGMENTS,
        PLATFORM_SEGMENTS
    );

    // Generate random mountain/hill positions (1-3 mountains per terrain)
    const numMountains = 1 + Math.floor(seededRandom(terrainSeed) * 3);
    const mountains = [];
    for (let m = 0; m < numMountains; m++) {
        mountains.push({
            x: (seededRandom(terrainSeed + m * 100) - 0.5) * (PLATFORM_SIZE - 1.5),
            y: (seededRandom(terrainSeed + m * 100 + 50) - 0.5) * (PLATFORM_SIZE - 1.5),
            height: 0.4 + seededRandom(terrainSeed + m * 100 + 25) * 0.5, // 0.4 to 0.9 height
            radius: 0.8 + seededRandom(terrainSeed + m * 100 + 75) * 1.0  // 0.8 to 1.8 radius
        });
    }

    const positions = geometry.attributes.position;
    const heightMap = []; // Store heights for edge matching

    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);

        // Base noise layers
        const fineNoise = terrainNoise(x * 0.6, y * 0.6, terrainSeed) * 0.15;
        const mediumNoise = terrainNoise(x * 0.3, y * 0.3, terrainSeed + 100) * 0.25;
        const largeNoise = terrainNoise(x * 0.15, y * 0.15, terrainSeed + 500) * 0.3;

        // Combine base noise
        let height = (fineNoise + mediumNoise + largeNoise - 0.35) * HEIGHT_VARIATION * 2;

        // Add mountain peaks!
        for (const mountain of mountains) {
            const dx = x - mountain.x;
            const dy = y - mountain.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < mountain.radius) {
                // Smooth mountain shape (like a bell curve)
                const t = dist / mountain.radius;
                // Use cosine for smooth mountain shape
                const mountainHeight = mountain.height * Math.cos(t * Math.PI / 2) * Math.cos(t * Math.PI / 2);
                height += mountainHeight;
            }
        }

        // Add some random small valleys too
        const valleyNoise = terrainNoise(x * 0.25, y * 0.25, terrainSeed + 777);
        if (valleyNoise < 0.2) {
            height -= 0.15 * (0.2 - valleyNoise) * 5;
        }

        positions.setZ(i, height);
        digHeights[i] = height;

        // Store for edge matching
        const col = i % (PLATFORM_SEGMENTS + 1);
        const row = Math.floor(i / (PLATFORM_SEGMENTS + 1));
        if (!heightMap[row]) heightMap[row] = [];
        heightMap[row][col] = height;
    }
    geometry.computeVertexNormals();

    const terrainColor = new THREE.Color(country.terrain.color);
    const darkerColor = terrainColor.clone().multiplyScalar(0.7);
    const darkestColor = terrainColor.clone().multiplyScalar(0.4);

    const material = new THREE.MeshStandardMaterial({
        color: country.terrain.color,
        roughness: country.terrain.roughness,
        metalness: 0.0,
        flatShading: true
    });

    digPlatform = new THREE.Mesh(geometry, material);
    digPlatform.rotation.x = -Math.PI / 2;
    digPlatform.position.y = TERRAIN_HEIGHT;
    digPlatform.receiveShadow = true;
    digPlatform.castShadow = true;
    digPlatform.name = 'digPlatform';
    scene.add(digPlatform);

    // Create SOLID sides using BufferGeometry for proper closed mesh
    const sideMaterial = new THREE.MeshStandardMaterial({
        color: darkerColor,
        roughness: country.terrain.roughness + 0.1,
        metalness: 0.0,
        flatShading: true,
        side: THREE.DoubleSide
    });

    // Create each side as a solid shape that matches the top edge heights
    // Front side (z = +PLATFORM_SIZE/2)
    createTerrainSide('front', heightMap, TERRAIN_HEIGHT, sideMaterial.clone(), terrainSides);

    // Back side (z = -PLATFORM_SIZE/2)
    createTerrainSide('back', heightMap, TERRAIN_HEIGHT, sideMaterial.clone(), terrainSides);

    // Left side (x = -PLATFORM_SIZE/2)
    createTerrainSide('left', heightMap, TERRAIN_HEIGHT, sideMaterial.clone(), terrainSides);

    // Right side (x = +PLATFORM_SIZE/2)
    createTerrainSide('right', heightMap, TERRAIN_HEIGHT, sideMaterial.clone(), terrainSides);

    // Bottom/base - slightly larger to ensure no gaps
    const baseMaterial = new THREE.MeshStandardMaterial({
        color: darkestColor,
        roughness: 1,
        metalness: 0
    });
    const baseGeo = new THREE.PlaneGeometry(PLATFORM_SIZE + 0.1, PLATFORM_SIZE + 0.1);
    terrainBase = new THREE.Mesh(baseGeo, baseMaterial);
    terrainBase.rotation.x = -Math.PI / 2;
    terrainBase.position.y = 0.001;
    terrainBase.receiveShadow = true;
    scene.add(terrainBase);

    addTerrainDetails(country, TERRAIN_HEIGHT);
}

function createTerrainSide(side, heightMap, baseHeight, material, sidesArray) {
    const segments = PLATFORM_SEGMENTS;
    const halfSize = PLATFORM_SIZE / 2;
    const segmentSize = PLATFORM_SIZE / segments;

    // Get the edge heights from the heightMap
    let edgeHeights = [];

    if (side === 'front') {
        // Bottom row of heightMap (z = +halfSize in world)
        edgeHeights = [...heightMap[segments]];
    } else if (side === 'back') {
        // Top row of heightMap (z = -halfSize in world)
        edgeHeights = [...heightMap[0]].reverse();
    } else if (side === 'left') {
        // First column (reversed for correct winding)
        for (let row = segments; row >= 0; row--) {
            edgeHeights.push(heightMap[row][0]);
        }
    } else if (side === 'right') {
        // Last column
        for (let row = 0; row <= segments; row++) {
            edgeHeights.push(heightMap[row][segments]);
        }
    }

    // Create vertices for the side
    const vertices = [];
    const indices = [];

    for (let i = 0; i <= segments; i++) {
        const edgeHeight = edgeHeights[i] !== undefined ? edgeHeights[i] : 0;

        let x, z;
        if (side === 'front') {
            x = -halfSize + i * segmentSize;
            z = halfSize;
        } else if (side === 'back') {
            x = halfSize - i * segmentSize;
            z = -halfSize;
        } else if (side === 'left') {
            x = -halfSize;
            z = halfSize - i * segmentSize;
        } else if (side === 'right') {
            x = halfSize;
            z = -halfSize + i * segmentSize;
        }

        // Top vertex (at terrain surface)
        vertices.push(x, baseHeight + edgeHeight, z);
        // Bottom vertex (at ground level)
        vertices.push(x, 0, z);
    }

    // Create triangles
    for (let i = 0; i < segments; i++) {
        const topLeft = i * 2;
        const bottomLeft = i * 2 + 1;
        const topRight = (i + 1) * 2;
        const bottomRight = (i + 1) * 2 + 1;

        // Two triangles per quad
        indices.push(topLeft, bottomLeft, topRight);
        indices.push(bottomLeft, bottomRight, topRight);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    scene.add(mesh);
    sidesArray.push(mesh);
}

function addTerrainDetails(country, terrainHeight) {
    const particleCount = 50;
    const colors = {
        sand: [0xc2a060, 0xa08040, 0xd4b874],
        dirt: [0x5c4030, 0x4a3020, 0x6b5040],
        soil: [0x3d2817, 0x2d1807, 0x4d3827]
    };
    const typeColors = colors[country.terrain.type] || colors.dirt;

    // Helper to get terrain height at a position
    const getTerrainHeightAt = (x, z) => {
        if (!digPlatform) return terrainHeight;
        const positions = digPlatform.geometry.attributes.position;
        const localX = x;
        const localY = -z;

        let minDist = Infinity;
        let height = 0;

        for (let i = 0; i < positions.count; i++) {
            const vx = positions.getX(i);
            const vy = positions.getY(i);
            const dist = Math.sqrt((vx - localX) ** 2 + (vy - localY) ** 2);
            if (dist < minDist) {
                minDist = dist;
                height = positions.getZ(i);
            }
        }
        return terrainHeight + height;
    };

    // Scatter rocks/pebbles on top surface
    for (let i = 0; i < particleCount; i++) {
        const size = 0.02 + Math.random() * 0.05;
        const geo = new THREE.DodecahedronGeometry(size, 0);
        const mat = new THREE.MeshStandardMaterial({
            color: typeColors[Math.floor(Math.random() * typeColors.length)],
            roughness: 1
        });
        const particle = new THREE.Mesh(geo, mat);
        const px = (Math.random() - 0.5) * (PLATFORM_SIZE - 0.5);
        const pz = (Math.random() - 0.5) * (PLATFORM_SIZE - 0.5);
        const surfaceHeight = getTerrainHeightAt(px, pz);
        particle.position.set(px, surfaceHeight + 0.02 + Math.random() * 0.02, pz);
        particle.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        particle.castShadow = true;
        particle.userData.isParticle = true;
        scene.add(particle);
    }

    // Add some larger rocks/clumps
    for (let i = 0; i < 8; i++) {
        const size = 0.06 + Math.random() * 0.08;
        const geo = new THREE.DodecahedronGeometry(size, 1);
        const mat = new THREE.MeshStandardMaterial({
            color: typeColors[Math.floor(Math.random() * typeColors.length)],
            roughness: 0.9
        });
        const rock = new THREE.Mesh(geo, mat);
        const rx = (Math.random() - 0.5) * (PLATFORM_SIZE - 0.8);
        const rz = (Math.random() - 0.5) * (PLATFORM_SIZE - 0.8);
        const surfaceHeight = getTerrainHeightAt(rx, rz);
        rock.position.set(rx, surfaceHeight + size * 0.3, rz);
        rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        rock.scale.y = 0.5 + Math.random() * 0.3;
        rock.castShadow = true;
        rock.receiveShadow = true;
        rock.userData.isParticle = true;
        scene.add(rock);
    }
}

function darkenColor(color, amount) {
    const c = new THREE.Color(color);
    c.multiplyScalar(1 - amount);
    return c;
}

// ============================================
// SHOVEL DIGGING ANIMATION
// ============================================

function onCanvasClick(event) {
    if (isShovelAnimating) return;

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    // First check if we clicked on a revealed artifact
    const artifactMeshes = artifacts
        .filter(a => a.revealed)
        .map(a => a.mesh);

    if (artifactMeshes.length > 0) {
        const artifactIntersects = raycaster.intersectObjects(artifactMeshes, true);
        if (artifactIntersects.length > 0) {
            // Find which artifact was clicked
            let clickedMesh = artifactIntersects[0].object;
            // Walk up to find the artifact group
            while (clickedMesh.parent && !clickedMesh.userData.artifactInfo) {
                clickedMesh = clickedMesh.parent;
            }

            // Find the artifact data
            const clickedArtifact = artifacts.find(a => a.mesh === clickedMesh);
            console.log('[Click] Artifact clicked:', clickedArtifact?.artifactData?.title, 'mesh match:', !!clickedArtifact);

            if (clickedArtifact && clickedArtifact.artifactData) {
                showArtifactInspector(clickedArtifact.artifactData);
                return; // Don't dig
            }
        }
    }

    // Otherwise, dig at the terrain
    const intersects = raycaster.intersectObject(digPlatform);

    if (intersects.length > 0) {
        const point = intersects[0].point;
        animateShovelDig(point);
    }
}

/**
 * Show fullscreen 3D artifact inspection - CS2 style!
 */
let inspectorScene, inspectorCamera, inspectorRenderer, inspectorControls;
let inspectorArtifact = null;
let inspectorAnimationId = null;
let inspectorSpotLight = null;
let inspectorSpotTarget = null;

// Helper function to make textures "cover" the frame (like CSS object-fit: cover)
function applyTextureCover(texture, frameAspect = 1) {
    if (!texture?.image?.width || !texture?.image?.height) return;

    const imgAspect = texture.image.width / texture.image.height;

    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;

    texture.repeat.set(1, 1);
    texture.offset.set(0, 0);

    if (imgAspect > frameAspect) {
        const scaleX = frameAspect / imgAspect;
        texture.repeat.set(scaleX, 1);
        texture.offset.set((1 - scaleX) / 2, 0);
    } else {
        const scaleY = imgAspect / frameAspect;
        texture.repeat.set(1, scaleY);
        texture.offset.set(0, (1 - scaleY) / 2);
    }

    texture.needsUpdate = true;
}

function showArtifactInspector(artifactData) {
    console.log('[Inspector] Opening inspector for:', artifactData?.title);

    const modal = document.getElementById('artifact-inspector-modal');
    const canvas = document.getElementById('inspector-canvas');

    if (!modal || !canvas) {
        console.error('[Inspector] Missing HTML elements! Need #artifact-inspector-modal and #inspector-canvas');
        alert('Inspector modal not found! Add the inspector HTML to your index.html');
        return;
    }

    modal.style.display = 'flex';
    initInspectorScene(artifactData);
}

function initInspectorScene(artifactData) {
    const canvas = document.getElementById('inspector-canvas');

    // Clean up previous scene if exists
    if (inspectorRenderer) {
        inspectorRenderer.dispose();
    }
    if (inspectorAnimationId) {
        cancelAnimationFrame(inspectorAnimationId);
    }

    // Scene with blue background (change hex value to adjust darkness)
    // Options: 0x1e3a4c (darkest), 0x2c4a5e (medium), 0x3a5a70 (lighter), 0x4a6d8a (lightest)
    inspectorScene = new THREE.Scene();
    inspectorScene.background = new THREE.Color(0x2c4a5e);

    // Camera
    inspectorCamera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
    inspectorCamera.position.set(0, 0.1, 2.5);

    // Renderer
    inspectorRenderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        alpha: false
    });
    inspectorRenderer.setSize(canvas.clientWidth, canvas.clientHeight);
    inspectorRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    inspectorRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    inspectorRenderer.toneMappingExposure = 1.2;
    inspectorRenderer.shadowMap.enabled = true;
    inspectorRenderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Controls
    inspectorControls = new OrbitControls(inspectorCamera, canvas);
    inspectorControls.enableDamping = true;
    inspectorControls.dampingFactor = 0.05;
    inspectorControls.enablePan = false;
    inspectorControls.minDistance = 1.2;
    inspectorControls.maxDistance = 4;
    inspectorControls.autoRotate = true;
    inspectorControls.autoRotateSpeed = 1.5;
    inspectorControls.target.set(0, 0, 0);

    // Strong key light from front-top
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
    keyLight.position.set(2, 3, 4);
    keyLight.castShadow = true;
    inspectorScene.add(keyLight);

    // Fill light from the other side
    const fillLight = new THREE.DirectionalLight(0xffffff, 1.5);
    fillLight.position.set(-2, 2, 3);
    inspectorScene.add(fillLight);

    // Back light for rim
    const backLight = new THREE.DirectionalLight(0xffd700, 1.0);
    backLight.position.set(0, 1, -3);
    inspectorScene.add(backLight);

    // Strong ambient so textures are visible
    const ambient = new THREE.AmbientLight(0xffffff, 0.8);
    inspectorScene.add(ambient);

    // Stop auto-rotate when user interacts
    canvas.addEventListener('pointerdown', () => {
        inspectorControls.autoRotate = false;
    });

    // Create floating dust particles
    const particleCount = 30;
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
        particlePositions[i * 3] = (Math.random() - 0.5) * 4;
        particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 3;
        particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 4;
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

    const particleMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.02,
        transparent: true,
        opacity: 0.5,
        sizeAttenuation: true
    });

    const particles = new THREE.Points(particleGeometry, particleMaterial);
    particles.userData.isParticle = true;
    inspectorScene.add(particles);

    // Create the artifact display
    createInspectorArtifact(artifactData);

    // Animation loop with particle animation
    let time = 0;
    function animateInspector() {
        inspectorAnimationId = requestAnimationFrame(animateInspector);
        time += 0.005;

        // Animate particles floating
        const positions = particles.geometry.attributes.position.array;
        for (let i = 0; i < particleCount; i++) {
            positions[i * 3 + 1] += Math.sin(time + i) * 0.0003;
            positions[i * 3] += Math.cos(time + i * 0.5) * 0.0002;
        }
        particles.geometry.attributes.position.needsUpdate = true;

        inspectorControls.update();
        inspectorRenderer.render(inspectorScene, inspectorCamera);
    }
    animateInspector();

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
        if (canvas.clientWidth > 0 && canvas.clientHeight > 0) {
            inspectorCamera.aspect = canvas.clientWidth / canvas.clientHeight;
            inspectorCamera.updateProjectionMatrix();
            inspectorRenderer.setSize(canvas.clientWidth, canvas.clientHeight);
        }
    });
    resizeObserver.observe(canvas);
}


async function createInspectorArtifact(artifactData) {
    if (inspectorArtifact) {
        inspectorScene.remove(inspectorArtifact);
    }

    const group = new THREE.Group();

    const frameSize = 0.8;
    const frameDepth = 0.06;
    const frameBorder = 0.05;
    const frameBottomY = -(frameSize / 2 + frameBorder);

    let texture = null;
    const imageUrl = artifactData.image;

    console.log('[Inspector] Loading image:', imageUrl);

    if (imageUrl) {
        try {
            texture = await loadTextureAsync(imageUrl);
            texture.colorSpace = THREE.SRGBColorSpace;
            console.log('[Inspector] Texture loaded successfully');
        } catch (err) {
            console.warn('[Inspector] Failed to load texture:', err);
        }
    }

    // ============ ORNATE GOLDEN FRAME ============
    const goldMat = new THREE.MeshStandardMaterial({
        color: 0xd4af37,
        roughness: 0.3,
        metalness: 0.8
    });

    const frameGroup = new THREE.Group();

    // Frame borders
    const topBorder = new THREE.Mesh(
        new THREE.BoxGeometry(frameSize + frameBorder * 2, frameBorder, frameDepth),
        goldMat
    );
    topBorder.position.y = frameSize / 2 + frameBorder / 2;
    frameGroup.add(topBorder);

    const bottomBorder = new THREE.Mesh(
        new THREE.BoxGeometry(frameSize + frameBorder * 2, frameBorder, frameDepth),
        goldMat
    );
    bottomBorder.position.y = -frameSize / 2 - frameBorder / 2;
    frameGroup.add(bottomBorder);

    const leftBorder = new THREE.Mesh(
        new THREE.BoxGeometry(frameBorder, frameSize, frameDepth),
        goldMat
    );
    leftBorder.position.x = -frameSize / 2 - frameBorder / 2;
    frameGroup.add(leftBorder);

    const rightBorder = new THREE.Mesh(
        new THREE.BoxGeometry(frameBorder, frameSize, frameDepth),
        goldMat
    );
    rightBorder.position.x = frameSize / 2 + frameBorder / 2;
    frameGroup.add(rightBorder);

    // Corner ornaments
    const corners = [
        [-frameSize / 2 - frameBorder / 2, frameSize / 2 + frameBorder / 2],
        [frameSize / 2 + frameBorder / 2, frameSize / 2 + frameBorder / 2],
        [-frameSize / 2 - frameBorder / 2, -frameSize / 2 - frameBorder / 2],
        [frameSize / 2 + frameBorder / 2, -frameSize / 2 - frameBorder / 2]
    ];

    corners.forEach(([x, y]) => {
        const sphere = new THREE.Mesh(
            new THREE.SphereGeometry(0.03, 16, 16),
            goldMat
        );
        sphere.position.set(x, y, frameDepth / 2);
        frameGroup.add(sphere);
    });

    group.add(frameGroup);

    // ============ BACKING ============
    const backMat = new THREE.MeshStandardMaterial({
        color: 0xf5f5dc,
        roughness: 0.9,
        metalness: 0.0,
        side: THREE.DoubleSide
    });

    const back = new THREE.Mesh(
        new THREE.PlaneGeometry(frameSize, frameSize),
        backMat
    );
    back.position.z = -frameDepth / 2 + 0.001;
    group.add(back);

    // ============ ARTIFACT IMAGE ============
    if (texture) {
        applyTextureCover(texture, 1);

        const imageMat = new THREE.MeshStandardMaterial({
            map: texture,
            roughness: 0.5,
            metalness: 0.0,
            side: THREE.DoubleSide
        });

        const imagePlane = new THREE.Mesh(
            new THREE.PlaneGeometry(frameSize - 0.02, frameSize - 0.02),
            imageMat
        );
        imagePlane.position.z = -frameDepth / 2 + 0.01;
        group.add(imagePlane);
    } else {
        // Fallback 3D shape
        const artifact3D = create3DArtifactShape(artifactData);
        artifact3D.scale.setScalar(2.5);
        group.add(artifact3D);
    }

    // ============ PEDESTAL ============
    const pedestalMat = new THREE.MeshStandardMaterial({
        color: 0x1a1a1a,
        roughness: 0.5,
        metalness: 0.4
    });

    const connectorHeight = 0.04;
    const columnHeight = 0.5;
    const baseHeight = 0.06;

    // Connector
    const connector = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, connectorHeight, 0.05),
        goldMat
    );
    connector.position.set(0, frameBottomY - connectorHeight / 2, 0);
    group.add(connector);

    // Column
    const column = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.09, columnHeight, 32),
        pedestalMat
    );
    column.position.set(0, frameBottomY - connectorHeight - columnHeight / 2, 0);
    group.add(column);

    // Base
    const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.22, baseHeight, 32),
        pedestalMat
    );
    base.position.set(0, frameBottomY - connectorHeight - columnHeight - baseHeight / 2, 0);
    group.add(base);

    // Gold trim ring
    const trim = new THREE.Mesh(
        new THREE.TorusGeometry(0.19, 0.012, 16, 32),
        goldMat
    );
    trim.rotation.x = Math.PI / 2;
    trim.position.copy(base.position);
    trim.position.y += baseHeight / 2;
    group.add(trim);

    // ============ GLASS CASE (subtle) ============
    const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.08,
        roughness: 0.0,
        metalness: 0.0,
        side: THREE.DoubleSide,
        depthWrite: false
    });

    const caseWidth = frameSize + frameBorder * 2 + 0.12;
    const caseHeight = frameSize + frameBorder * 2 + 0.08;
    const caseDepth = 0.2;

    // Just front glass panel
    const glassFront = new THREE.Mesh(
        new THREE.PlaneGeometry(caseWidth, caseHeight),
        glassMat
    );
    glassFront.position.z = caseDepth / 2;
    group.add(glassFront);

    // Gold edges on glass
    const edgeMat = new THREE.MeshStandardMaterial({
        color: 0xd4af37,
        roughness: 0.3,
        metalness: 0.8
    });

    const edgeGeo = new THREE.CylinderGeometry(0.006, 0.006, caseHeight, 8);

    const leftEdge = new THREE.Mesh(edgeGeo, edgeMat);
    leftEdge.position.set(-caseWidth / 2, 0, caseDepth / 2);
    group.add(leftEdge);

    const rightEdge = new THREE.Mesh(edgeGeo, edgeMat);
    rightEdge.position.set(caseWidth / 2, 0, caseDepth / 2);
    group.add(rightEdge);

    // Center the display slightly up
    group.position.y = 0.1;

    inspectorArtifact = group;
    inspectorScene.add(group);
}

function closeArtifactInspector() {
    const modal = document.getElementById('artifact-inspector-modal');
    if (modal) {
        modal.style.display = 'none';
    }

    // Clean up
    if (inspectorAnimationId) {
        cancelAnimationFrame(inspectorAnimationId);
        inspectorAnimationId = null;
    }

    // Re-enable auto-rotate for next time
    if (inspectorControls) {
        inspectorControls.autoRotate = true;
    }
}

// Expose to window for HTML onclick
window.closeArtifactInspector = closeArtifactInspector;

// ESC key to close inspector
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modal = document.getElementById('artifact-inspector-modal');
        if (modal && modal.style.display === 'flex') {
            closeArtifactInspector();
        }
    }
});

/**
 * Handle mouse move to show pointer cursor over clickable artifacts
 */
function onCanvasMouseMove(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    // Check if hovering over a revealed artifact
    const artifactMeshes = artifacts
        .filter(a => a.revealed)
        .map(a => a.mesh);

    if (artifactMeshes.length > 0) {
        const artifactIntersects = raycaster.intersectObjects(artifactMeshes, true);
        if (artifactIntersects.length > 0) {
            renderer.domElement.style.cursor = 'pointer';
            return;
        }
    }

    // Check if hovering over dig platform
    const platformIntersects = raycaster.intersectObject(digPlatform);
    if (platformIntersects.length > 0) {
        renderer.domElement.style.cursor = 'crosshair';
        return;
    }

    renderer.domElement.style.cursor = 'default';
}

function animateShovelDig(targetPoint) {
    if (!shovel || isShovelAnimating) return;
    isShovelAnimating = true;
    digTargetPoint = targetPoint.clone();

    const startPos = shovel.position.clone();
    const startRot = new THREE.Euler().copy(shovel.rotation);

    // Get the terrain height at the dig point
    const terrainHeight = targetPoint.y;

    // Animation phases - realistic shovel motion
    const phase1Duration = 200;  // Position above, blade vertical
    const phase2Duration = 150;  // Push blade straight down into ground
    const phase3Duration = 100;  // Push deeper (like stepping on shovel)
    const phase4Duration = 250;  // Lever handle back to scoop
    const phase5Duration = 200;  // Lift dirt out of hole
    const phase6Duration = 300;  // Swing and throw dirt
    const phase7Duration = 250;  // Return to rest

    const startTime = Date.now();

    // Key positions for realistic dig motion
    const abovePos = new THREE.Vector3(targetPoint.x, terrainHeight + 0.6, targetPoint.z + 0.3);
    const insertPos = new THREE.Vector3(targetPoint.x, terrainHeight + 0.1, targetPoint.z + 0.15);
    const deepPos = new THREE.Vector3(targetPoint.x, terrainHeight - 0.1, targetPoint.z + 0.1);
    const leverPos = new THREE.Vector3(targetPoint.x, terrainHeight + 0.2, targetPoint.z + 0.5);
    const liftPos = new THREE.Vector3(targetPoint.x, terrainHeight + 0.8, targetPoint.z + 0.6);
    const throwPos = new THREE.Vector3(targetPoint.x + 1.0, terrainHeight + 0.5, targetPoint.z + 0.8);

    function animatePhase() {
        const elapsed = Date.now() - startTime;
        let progress;
        let phaseEnd = 0;

        // Phase 1: Position above dig point, blade angled but more upright
        phaseEnd = phase1Duration;
        if (elapsed < phaseEnd) {
            progress = elapsed / phase1Duration;
            const eased = easeOutCubic(progress);
            shovel.position.lerpVectors(startPos, abovePos, eased);
            // Blade more upright, slight forward tilt
            shovel.rotation.x = lerp(startRot.x, 0.5, eased);
            shovel.rotation.y = lerp(startRot.y, 0, eased);
            shovel.rotation.z = lerp(startRot.z, 0, eased);
            requestAnimationFrame(animatePhase);
            return;
        }

        // Phase 2: Push blade down into ground
        phaseEnd += phase2Duration;
        if (elapsed < phaseEnd) {
            progress = (elapsed - phase1Duration) / phase2Duration;
            const eased = easeInCubic(progress);
            shovel.position.lerpVectors(abovePos, insertPos, eased);
            // Tilt forward a bit as it goes in
            shovel.rotation.x = lerp(0.5, 0.3, eased);
            requestAnimationFrame(animatePhase);
            return;
        }

        // Phase 3: Push deeper (like stepping on it)
        phaseEnd += phase3Duration;
        if (elapsed < phaseEnd) {
            progress = (elapsed - phase1Duration - phase2Duration) / phase3Duration;
            const eased = easeInCubic(progress);
            shovel.position.lerpVectors(insertPos, deepPos, eased);
            // Slight more forward as it goes deeper
            shovel.rotation.x = lerp(0.3, 0.15, eased);

            // Trigger dig here
            if (progress < 0.2) {
                digAt(targetPoint.x, targetPoint.z);
                audioManager.playDig();
            }
            requestAnimationFrame(animatePhase);
            return;
        }

        // Phase 4: Lever handle back to scoop dirt onto blade
        phaseEnd += phase4Duration;
        if (elapsed < phaseEnd) {
            progress = (elapsed - phase1Duration - phase2Duration - phase3Duration) / phase4Duration;
            const eased = easeOutCubic(progress);
            shovel.position.lerpVectors(deepPos, leverPos, eased);
            // Pull handle back - blade tips up to scoop
            shovel.rotation.x = lerp(0.15, 1.4, eased);
            requestAnimationFrame(animatePhase);
            return;
        }

        // Phase 5: Lift dirt out of hole
        phaseEnd += phase5Duration;
        if (elapsed < phaseEnd) {
            progress = (elapsed - phase1Duration - phase2Duration - phase3Duration - phase4Duration) / phase5Duration;
            const eased = easeOutCubic(progress);
            shovel.position.lerpVectors(leverPos, liftPos, eased);
            // Keep blade tipped back to hold dirt
            shovel.rotation.x = lerp(1.4, 1.2, eased);
            requestAnimationFrame(animatePhase);
            return;
        }

        // Phase 6: Swing to side and throw dirt
        phaseEnd += phase6Duration;
        if (elapsed < phaseEnd) {
            progress = (elapsed - phase1Duration - phase2Duration - phase3Duration - phase4Duration - phase5Duration) / phase6Duration;
            const eased = easeOutCubic(progress);
            shovel.position.lerpVectors(liftPos, throwPos, eased);
            // Twist and flip to dump dirt
            shovel.rotation.x = lerp(1.2, 0.6, eased);
            shovel.rotation.y = lerp(0, -1.2, eased);
            shovel.rotation.z = lerp(0, 0.5, eased);

            // Create dirt particles when dumping
            if (progress > 0.3 && progress < 0.45) {
                createThrownDirt(shovel.position.clone());
                audioManager.playThrow();
            }
            requestAnimationFrame(animatePhase);
            return;
        }

        // Phase 7: Return to rest
        phaseEnd += phase7Duration;
        if (elapsed < phaseEnd) {
            progress = (elapsed - phase1Duration - phase2Duration - phase3Duration - phase4Duration - phase5Duration - phase6Duration) / phase7Duration;
            const eased = easeOutCubic(progress);
            shovel.position.lerpVectors(throwPos, startPos, eased);
            shovel.rotation.x = lerp(0.6, startRot.x, eased);
            shovel.rotation.y = lerp(-1.2, startRot.y, eased);
            shovel.rotation.z = lerp(0.5, startRot.z, eased);
            requestAnimationFrame(animatePhase);
            return;
        }

        // Animation complete
        shovel.position.copy(startPos);
        shovel.rotation.copy(startRot);
        isShovelAnimating = false;
    }

    animatePhase();
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

function easeInCubic(t) {
    return t * t * t;
}

function createThrownDirt(position) {
    const particleCount = 15;

    for (let i = 0; i < particleCount; i++) {
        const size = 0.03 + Math.random() * 0.05;
        const geo = new THREE.SphereGeometry(size, 4, 4);
        const mat = new THREE.MeshBasicMaterial({
            color: currentCountry.terrain.color,
            transparent: true,
            opacity: 0.9
        });
        const particle = new THREE.Mesh(geo, mat);
        particle.position.copy(position);
        particle.position.x += (Math.random() - 0.5) * 0.3;
        particle.position.z += (Math.random() - 0.5) * 0.3;

        scene.add(particle);

        const velocityX = 0.02 + Math.random() * 0.03;
        const velocityY = 0.03 + Math.random() * 0.02;
        const velocityZ = (Math.random() - 0.5) * 0.02;
        const gravity = 0.003;
        const startTime = Date.now();

        function animateParticle() {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / 800;

            if (progress < 1 && particle.position.y > -0.4) {
                particle.position.x += velocityX;
                particle.position.y += velocityY - gravity * elapsed * 0.01;
                particle.position.z += velocityZ;
                particle.material.opacity = 0.9 * (1 - progress);
                requestAnimationFrame(animateParticle);
            } else {
                scene.remove(particle);
                particle.geometry.dispose();
                particle.material.dispose();
            }
        }
        animateParticle();
    }
}

// ============================================
// TERRAIN DIGGING
// ============================================

function digAt(worldX, worldZ) {
    if (!digPlatform) return;

    const geometry = digPlatform.geometry;
    const positions = geometry.attributes.position;

    // Convert world coordinates to local platform coordinates
    // The platform is rotated -90 degrees on X axis, so:
    // - local X = world X
    // - local Y = -world Z (due to rotation)
    const localX = worldX;
    const localY = -worldZ;

    let dug = false;

    for (let i = 0; i < positions.count; i++) {
        const vx = positions.getX(i);
        const vy = positions.getY(i);

        const dx = vx - localX;
        const dy = vy - localY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < DIG_RADIUS) {
            const strength = 1 - (dist / DIG_RADIUS);
            const digAmount = DIG_DEPTH * strength * strength;

            const currentZ = positions.getZ(i);
            const newZ = Math.max(currentZ - digAmount, -MAX_DIG_DEPTH);

            if (newZ !== currentZ) {
                positions.setZ(i, newZ);
                digHeights[i] = newZ;
                dug = true;
            }
        }
    }

    if (dug) {
        positions.needsUpdate = true;
        geometry.computeVertexNormals();
        checkArtifactReveal(worldX, worldZ);
    }
}

// ============================================
// ARTIFACT SYSTEM
// ============================================

function createDirtMound(position, country, revealDepth) {
    // No longer needed - terrain is now a thick pile
    return null;
}

async function placeArtifacts(country) {
    // Remove old artifacts
    artifacts.forEach(a => {
        scene.remove(a.mesh);
        // Dispose textures and materials
        if (a.mesh.material) {
            if (a.mesh.material.map) a.mesh.material.map.dispose();
            a.mesh.material.dispose();
        }
        if (a.mesh.geometry) a.mesh.geometry.dispose();
    });
    artifacts = [];

    const TERRAIN_HEIGHT = 1.0;
    const NUM_ARTIFACTS = 5;

    // Fetch artifacts from API service - try real museum photos first, fall back to icons
    console.log(`[placeArtifacts] Fetching ${NUM_ARTIFACTS} artifacts for ${country.name}...`);
    const apiArtifacts = await artifactService.getArtifacts(country.name, NUM_ARTIFACTS, false); // false = try API first

    if (!apiArtifacts || apiArtifacts.length === 0) {
        console.warn(`[placeArtifacts] No artifacts returned for ${country.name}`);
        return;
    }

    console.log(`[placeArtifacts] Got ${apiArtifacts.length} artifacts from API`);
    totalArtifacts = apiArtifacts.length;

    const positions = [];
    const minDist = 1.2;

    for (let i = 0; i < apiArtifacts.length; i++) {
        let pos;
        let attempts = 0;

        do {
            pos = new THREE.Vector2(
                (Math.random() - 0.5) * (PLATFORM_SIZE - 1.5),
                (Math.random() - 0.5) * (PLATFORM_SIZE - 1.5)
            );
            attempts++;
        } while (
            positions.some(p => p.distanceTo(pos) < minDist) &&
            attempts < 50
            );

        positions.push(pos);

        const artifactData = apiArtifacts[i];
        const mesh = await createArtifactFromAPI(artifactData);

        if (!mesh) {
            console.error(`[placeArtifacts] Failed to create artifact: ${artifactData.title}`);
            continue;
        }

        // Get the actual terrain surface height at this position
        const surfaceHeight = getTerrainHeightAt(pos.x, pos.y);

        // Artifacts are buried INSIDE the terrain pile
        const revealDepth = 0.2 + Math.random() * 0.2;

        // Position artifact just below the actual terrain surface
        const artifactY = surfaceHeight - revealDepth;
        mesh.position.set(pos.x, artifactY, pos.y);
        mesh.visible = false;
        mesh.userData.revealed = false;
        mesh.userData.revealDepth = revealDepth;
        mesh.userData.baseY = artifactY;
        mesh.userData.surfaceHeight = surfaceHeight;
        mesh.userData.artifactInfo = artifactData; // Store artifact info for later display

        console.log(`[placeArtifacts] Placed "${artifactData.title}" at (${pos.x.toFixed(2)}, ${artifactY.toFixed(2)}, ${pos.y.toFixed(2)})`);

        scene.add(mesh);

        artifacts.push({
            mesh,
            position: pos,
            type: artifactData.title,
            revealed: false,
            revealDepth: revealDepth,
            surfaceHeight: surfaceHeight,
            artifactData: artifactData
        });
    }
}

/**
 * Create a 3D artifact mesh from API data
 * Uses SVG icons (more reliable) or falls back to colored placeholder
 */
async function createArtifactFromAPI(artifactData) {
    const group = new THREE.Group();

    // Try to load image texture
    const imageUrl = artifactData.image;
    let textureLoaded = false;

    if (imageUrl) {
        try {
            const texture = await loadTextureAsync(imageUrl);

            // Create a framed artifact display
            const frameSize = 0.4;
            const frameDepth = 0.05;
            const frameBorder = 0.025;

            // Frame (wooden border)
            const frameMaterial = new THREE.MeshStandardMaterial({
                color: 0x8B4513,
                roughness: 0.6,
                metalness: 0.2
            });

            // Create frame as 4 border pieces
            const frameGroup = new THREE.Group();

            // Top border
            const topBorder = new THREE.Mesh(
                new THREE.BoxGeometry(frameSize + frameBorder * 2, frameBorder, frameDepth),
                frameMaterial
            );
            topBorder.position.y = frameSize / 2 + frameBorder / 2;
            frameGroup.add(topBorder);

            // Bottom border
            const bottomBorder = new THREE.Mesh(
                new THREE.BoxGeometry(frameSize + frameBorder * 2, frameBorder, frameDepth),
                frameMaterial
            );
            bottomBorder.position.y = -frameSize / 2 - frameBorder / 2;
            frameGroup.add(bottomBorder);

            // Left border
            const leftBorder = new THREE.Mesh(
                new THREE.BoxGeometry(frameBorder, frameSize, frameDepth),
                frameMaterial
            );
            leftBorder.position.x = -frameSize / 2 - frameBorder / 2;
            frameGroup.add(leftBorder);

            // Right border
            const rightBorder = new THREE.Mesh(
                new THREE.BoxGeometry(frameBorder, frameSize, frameDepth),
                frameMaterial
            );
            rightBorder.position.x = frameSize / 2 + frameBorder / 2;
            frameGroup.add(rightBorder);

            frameGroup.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = false;
                    child.receiveShadow = false;
                }
            });
            group.add(frameGroup);

            // Back panel (canvas)
            const backGeometry = new THREE.PlaneGeometry(frameSize, frameSize);
            const backMaterial = new THREE.MeshStandardMaterial({
                color: 0xf5f5dc,
                roughness: 0.9,
                metalness: 0.0,
                side: THREE.DoubleSide
            });

            const back = new THREE.Mesh(
                new THREE.PlaneGeometry(frameSize, frameSize),
                backMaterial
            );
            back.position.z = -frameDepth / 2 + 0.001;
            group.add(back);

            texture.colorSpace = THREE.SRGBColorSpace;
            applyTextureCover(texture, 1);

            // Image plane with texture
            let aspect = 1;
            if (texture.image && texture.image.width && texture.image.height) {
                aspect = texture.image.width / texture.image.height;
            }

            let planeWidth = frameSize - 0.02;
            let planeHeight = frameSize - 0.02;

            if (aspect > 1) {
                planeHeight = planeWidth / aspect;
            } else {
                planeWidth = planeHeight * aspect;
            }

            const planeGeometry = new THREE.PlaneGeometry(frameSize - 0.02, frameSize - 0.02);
            const planeMaterial = new THREE.MeshStandardMaterial({
                map: texture,
                roughness: 0.7,
                metalness: 0.0,
                side: THREE.DoubleSide,
                polygonOffset: true,
                polygonOffsetFactor: -1,
                polygonOffsetUnits: -1
            });

            const imagePlane = new THREE.Mesh(planeGeometry, planeMaterial);
            imagePlane.position.z = -frameDepth / 2 + 0.006;
            group.add(imagePlane);

            textureLoaded = true;
            console.log(`[createArtifactFromAPI] Loaded texture for: ${artifactData.title}`);

        } catch (error) {
            console.warn(`[createArtifactFromAPI] Failed to load texture for ${artifactData.title}:`, error);
        }
    }

    // Fallback: Create a 3D artifact shape instead of flat image
    if (!textureLoaded) {
        const fallbackGroup = create3DArtifactShape(artifactData);
        group.add(fallbackGroup);
    }

    // Initially flat (lying face-up in the dirt)
    group.rotation.x = -Math.PI / 2;

    group.castShadow = true;
    group.receiveShadow = true;

    // Mark as artifact for raycasting
    group.userData.isArtifact = true;
    group.traverse(child => {
        if (child.isMesh) {
            child.userData.isArtifact = true;
        }
    });

    return group;
}

/**
 * Create a 3D shape to represent the artifact when texture fails
 */
function create3DArtifactShape(artifactData) {
    const group = new THREE.Group();
    const culture = artifactData.culture || '';
    const title = (artifactData.title || '').toLowerCase();

    // Get colors based on culture
    const color = getCountryColor(culture);
    const goldColor = 0xd4af37;

    const mainMat = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.4,
        metalness: 0.3
    });

    const accentMat = new THREE.MeshStandardMaterial({
        color: goldColor,
        roughness: 0.3,
        metalness: 0.7
    });

    // Create different shapes based on artifact type keywords
    if (title.includes('vase') || title.includes('jar') || title.includes('amphora') || title.includes('vessel') || title.includes('bottle')) {
        // Vase shape
        const points = [];
        for (let i = 0; i < 10; i++) {
            const t = i / 9;
            const r = 0.08 + Math.sin(t * Math.PI) * 0.08;
            points.push(new THREE.Vector2(r, t * 0.4 - 0.2));
        }
        const vaseGeo = new THREE.LatheGeometry(points, 16);
        const vase = new THREE.Mesh(vaseGeo, mainMat);
        group.add(vase);

        // Rim
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.015, 8, 16), accentMat);
        rim.position.y = 0.2;
        rim.rotation.x = Math.PI / 2;
        group.add(rim);

    } else if (title.includes('mask') || title.includes('head') || title.includes('bust') || title.includes('face')) {
        // Mask/face shape
        const maskGeo = new THREE.SphereGeometry(0.15, 16, 12, 0, Math.PI);
        const mask = new THREE.Mesh(maskGeo, mainMat);
        mask.rotation.y = Math.PI;
        group.add(mask);

        // Eyes
        const eyeGeo = new THREE.SphereGeometry(0.02, 8, 8);
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.05, 0.03, 0.12);
        group.add(leftEye);
        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.05, 0.03, 0.12);
        group.add(rightEye);

    } else if (title.includes('coin') || title.includes('disc') || title.includes('medal')) {
        // Coin shape
        const coinGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.02, 32);
        const coin = new THREE.Mesh(coinGeo, accentMat);
        coin.rotation.x = Math.PI / 2;
        group.add(coin);

        // Inner circle
        const innerGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.025, 32);
        const inner = new THREE.Mesh(innerGeo, mainMat);
        inner.rotation.x = Math.PI / 2;
        group.add(inner);

    } else if (title.includes('statue') || title.includes('figure') || title.includes('warrior')) {
        // Statue/figure shape
        const bodyGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.25, 8);
        const body = new THREE.Mesh(bodyGeo, mainMat);
        group.add(body);

        const headGeo = new THREE.SphereGeometry(0.05, 12, 12);
        const head = new THREE.Mesh(headGeo, mainMat);
        head.position.y = 0.17;
        group.add(head);

        // Base
        const baseGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.03, 16);
        const base = new THREE.Mesh(baseGeo, accentMat);
        base.position.y = -0.14;
        group.add(base);

    } else if (title.includes('sword') || title.includes('knife') || title.includes('blade') || title.includes('dagger')) {
        // Sword/blade shape
        const bladeGeo = new THREE.BoxGeometry(0.03, 0.3, 0.01);
        const blade = new THREE.Mesh(bladeGeo, new THREE.MeshStandardMaterial({
            color: 0xcccccc, roughness: 0.2, metalness: 0.9
        }));
        blade.position.y = 0.05;
        group.add(blade);

        // Handle
        const handleGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.1, 8);
        const handle = new THREE.Mesh(handleGeo, mainMat);
        handle.position.y = -0.15;
        group.add(handle);

        // Guard
        const guardGeo = new THREE.BoxGeometry(0.08, 0.015, 0.02);
        const guard = new THREE.Mesh(guardGeo, accentMat);
        guard.position.y = -0.1;
        group.add(guard);

    } else if (title.includes('helmet') || title.includes('armor') || title.includes('shield')) {
        // Helmet shape
        const helmetGeo = new THREE.SphereGeometry(0.12, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
        const helmet = new THREE.Mesh(helmetGeo, mainMat);
        group.add(helmet);

        // Crest
        const crestGeo = new THREE.BoxGeometry(0.02, 0.15, 0.12);
        const crest = new THREE.Mesh(crestGeo, accentMat);
        crest.position.y = 0.1;
        group.add(crest);

    } else {
        // Default: generic artifact (tablet/block shape)
        const blockGeo = new THREE.BoxGeometry(0.25, 0.3, 0.04);
        const block = new THREE.Mesh(blockGeo, mainMat);
        group.add(block);

        // Decorative border
        const borderGeo = new THREE.BoxGeometry(0.27, 0.32, 0.02);
        const borderMat = new THREE.MeshStandardMaterial({
            color: goldColor,
            roughness: 0.3,
            metalness: 0.7
        });
        const border = new THREE.Mesh(borderGeo, borderMat);
        border.position.z = -0.02;
        group.add(border);

        // Inner detail
        const detailGeo = new THREE.BoxGeometry(0.18, 0.22, 0.01);
        const detailMat = new THREE.MeshStandardMaterial({
            color: 0x333333,
            roughness: 0.8
        });
        const detail = new THREE.Mesh(detailGeo, detailMat);
        detail.position.z = 0.025;
        group.add(detail);
    }

    group.castShadow = true;
    return group;
}

/**
 * Add fallback display when texture fails
 */
function addFallbackDisplay(group, frameSize, frameDepth, artifactData) {
    const fallbackGeo = new THREE.PlaneGeometry(frameSize - 0.04, frameSize - 0.04);
    const fallbackMat = new THREE.MeshStandardMaterial({
        color: getCountryColor(artifactData.culture),
        roughness: 0.5
    });
    const fallback = new THREE.Mesh(fallbackGeo, fallbackMat);
    fallback.position.z = -frameDepth / 2 + 0.005;
    group.add(fallback);
}

/**
 * Helper to load texture as a promise
 */
function loadTextureAsync(url, timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
        if (!url) {
            reject(new Error('No URL provided'));
            return;
        }

        const img = new Image();
        let timedOut = false;

        // Timeout to prevent hanging
        const timeout = setTimeout(() => {
            timedOut = true;
            console.warn('[loadTextureAsync] Timeout loading:', url.substring(0, 60));
            reject(new Error('Image load timeout'));
        }, timeoutMs);

        // For data URLs, no CORS needed
        // For external URLs, try with crossOrigin
        if (!url.startsWith('data:')) {
            img.crossOrigin = 'anonymous';
        }

        img.onload = () => {
            if (timedOut) return;
            clearTimeout(timeout);

            try {
                // Create canvas to hold the image
                const canvas = document.createElement('canvas');

                // Use image dimensions but cap at reasonable size for textures
                const maxSize = 512;
                let width = img.naturalWidth || img.width || 256;
                let height = img.naturalHeight || img.height || 256;

                // Check for valid dimensions
                if (width <= 0 || height <= 0) {
                    reject(new Error('Invalid image dimensions'));
                    return;
                }

                // Scale down if too large
                if (width > maxSize || height > maxSize) {
                    const scale = maxSize / Math.max(width, height);
                    width = Math.floor(width * scale);
                    height = Math.floor(height * scale);
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');

                // Fill with background for SVGs with transparency
                ctx.fillStyle = '#f5f5dc';
                ctx.fillRect(0, 0, width, height);

                // Draw the image
                ctx.drawImage(img, 0, 0, width, height);

                // Check if canvas is tainted (CORS issue)
                try {
                    ctx.getImageData(0, 0, 1, 1);
                } catch (securityError) {
                    console.warn('[loadTextureAsync] CORS security error, canvas tainted');
                    reject(new Error('CORS blocked'));
                    return;
                }

                // Create texture from canvas
                const texture = new THREE.CanvasTexture(canvas);
                texture.needsUpdate = true;
                texture.colorSpace = THREE.SRGBColorSpace;

                console.log(`[loadTextureAsync] Success: ${width}x${height}`);
                resolve(texture);

            } catch (e) {
                console.error('[loadTextureAsync] Canvas error:', e);
                reject(e);
            }
        };

        img.onerror = (err) => {
            if (timedOut) return;
            clearTimeout(timeout);
            console.error('[loadTextureAsync] Image load error for:', url.substring(0, 60));
            reject(new Error('Image load failed'));
        };

        // Start loading
        img.src = url;
    });
}

/**
 * Get a color based on culture/country
 */
function getCountryColor(culture) {
    const colors = {
        'Egyptian': 0xd4a574,
        'Greek': 0x8b7355,
        'Chinese': 0x654321,
        'Japanese': 0x8b0000,
        'Aztec': 0xc2b280,
        'Maya': 0xa0522d,
        'Roman': 0x9b7653,
        'Indian': 0xb5651d,
        'Inca': 0xa0826d,
        'Moche': 0x8b6914
    };
    return colors[culture] || 0x888888;
}

// Get the actual terrain height at a world position
function getTerrainHeightAt(worldX, worldZ) {
    if (!digPlatform) return 1.0;

    const positions = digPlatform.geometry.attributes.position;
    const TERRAIN_HEIGHT = 1.0;

    // Convert world coordinates to local platform coordinates
    const localX = worldX;
    const localY = -worldZ;

    let closestDist = Infinity;
    let height = 0;

    for (let i = 0; i < positions.count; i++) {
        const vx = positions.getX(i);
        const vy = positions.getY(i);
        const dist = Math.sqrt((vx - localX) ** 2 + (vy - localY) ** 2);

        if (dist < closestDist) {
            closestDist = dist;
            height = positions.getZ(i);
        }
    }

    // Return the world Y position (TERRAIN_HEIGHT + local height offset)
    return TERRAIN_HEIGHT + height;
}

function checkArtifactReveal(digX, digZ) {
    artifacts.forEach(artifact => {
        if (artifact.revealed) return;

        const dx = artifact.position.x - digX;
        const dz = artifact.position.y - digZ;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < DIG_RADIUS * 2.5) {
            // Get current terrain height at artifact position
            const currentHeight = getTerrainHeightAt(artifact.position.x, artifact.position.y);
            // Calculate how much we've dug down from the original surface
            const dugDepth = artifact.surfaceHeight - currentHeight;
            const progress = Math.min(dugDepth / artifact.revealDepth, 1);

            // Start showing artifact tip when you've dug 40% of the way
            if (progress > 0.4 && !artifact.mesh.visible) {
                artifact.mesh.visible = true;
                console.log(`[checkArtifactReveal] ${artifact.type} now visible at progress ${progress.toFixed(2)}, dugDepth: ${dugDepth.toFixed(2)}`);
            }

            // Gradually raise artifact as digging continues
            if (artifact.mesh.visible && !artifact.revealed) {
                // Artifact rises from buried position to surface
                const riseAmount = progress * artifact.revealDepth;
                artifact.mesh.position.y = artifact.mesh.userData.baseY + riseAmount;
            }

            if (dugDepth >= artifact.revealDepth) {
                revealArtifact(artifact);
            }
        }
    });
}

function getDigDepthAt(x, z) {
    if (!digPlatform) return 0;

    const positions = digPlatform.geometry.attributes.position;
    let minDist = Infinity;
    let depth = 0;

    // Convert world coordinates to local platform coordinates
    const localX = x;
    const localY = -z;

    for (let i = 0; i < positions.count; i++) {
        const vx = positions.getX(i);
        const vy = positions.getY(i);
        const dist = Math.sqrt((vx - localX) ** 2 + (vy - localY) ** 2);

        if (dist < minDist) {
            minDist = dist;
            depth = -positions.getZ(i);
        }
    }

    return depth;
}

function revealArtifact(artifact) {
    audioManager.playReveal();

    artifact.revealed = true;
    artifact.mesh.visible = true;
    artifact.mesh.userData.revealed = true;

    // Update wallhack markers (remove this artifact's marker)
    if (wallhackEnabled) {
        updateWallhackMarkers();
    }

    const startY = artifact.mesh.position.y;
    const startRotX = artifact.mesh.rotation.x;
    const startRotY = artifact.mesh.rotation.y;

    // Pop up above the artifact's local terrain surface
    const targetY = (artifact.surfaceHeight || 1.0) + 0.5;
    // Target rotation: slightly tilted back to face the camera
    const targetRotX = -0.3;
    // Target Y rotation: face camera (0) + one full spin (2*PI)
    const targetRotY = startRotY + Math.PI * 2;

    const startTime = Date.now();
    const duration = 1200;

    function animateReveal() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);

        // Rise up
        artifact.mesh.position.y = startY + (targetY - startY) * eased;

        // Rotate from lying flat to standing upright
        artifact.mesh.rotation.x = startRotX + (targetRotX - startRotX) * eased;

        // Smooth spin - starts fast, slows down, ends at facing camera
        artifact.mesh.rotation.y = startRotY + (targetRotY - startRotY) * eased;

        if (progress < 1) {
            requestAnimationFrame(animateReveal);
        } else {
            // Normalize rotation to 0 (same visual, clean value)
            artifact.mesh.rotation.y = 0;

            artifactsFound++;
            updateUI();
            showRevealEffect(artifact.mesh.position);

            // Brief info popup (no country hints!)
            if (artifact.artifactData) {
                showArtifactInfo(artifact.artifactData);
            }
        }
    }

    animateReveal();
}

/**
 * Display brief artifact info when revealed (NO country/culture - that's a hint!)
 */
function showArtifactInfo(artifactData) {
    let infoEl = document.getElementById('artifact-info');
    if (!infoEl) {
        infoEl = document.createElement('div');
        infoEl.id = 'artifact-info';
        infoEl.style.cssText = `
            position: fixed;
            bottom: 120px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-family: 'Segoe UI', sans-serif;
            z-index: 1000;
            text-align: center;
            border: 2px solid #ffd700;
            box-shadow: 0 4px 20px rgba(255, 215, 0, 0.3);
            animation: slideUp 0.3s ease-out;
            pointer-events: none;
        `;
        document.body.appendChild(infoEl);

        if (!document.getElementById('artifact-info-styles')) {
            const style = document.createElement('style');
            style.id = 'artifact-info-styles';
            style.textContent = `
                @keyframes slideUp {
                    from { opacity: 0; transform: translateX(-50%) translateY(20px); }
                    to { opacity: 1; transform: translateX(-50%) translateY(0); }
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }
    }

    // Show title only - NO culture/period hints at all!
    infoEl.innerHTML = `
        <div style="font-size: 16px; font-weight: bold; color: #ffd700;">
            🏺 ${artifactData.title}
        </div>
        <div style="font-size: 11px; color: #666; margin-top: 6px;">
            Click artifact to inspect
        </div>
    `;
    infoEl.style.display = 'block';

    setTimeout(() => {
        if (infoEl) infoEl.style.display = 'none';
    }, 3000);
}

function showRevealEffect(position) {
    const ringGeo = new THREE.RingGeometry(0.1, 0.5, 32);
    const ringMat = new THREE.MeshBasicMaterial({
        color: 0xffd700,
        transparent: true,
        opacity: 1,
        side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(position);
    ring.position.y = 0.1;
    ring.rotation.x = -Math.PI / 2;
    scene.add(ring);

    const startTime = Date.now();

    function animateRing() {
        const elapsed = Date.now() - startTime;
        const progress = elapsed / 500;

        if (progress < 1) {
            ring.scale.setScalar(1 + progress * 2);
            ring.material.opacity = 1 - progress;
            requestAnimationFrame(animateRing);
        } else {
            scene.remove(ring);
            ring.geometry.dispose();
            ring.material.dispose();
        }
    }

    animateRing();
}

async function createArtifact(type) {
    console.log(`[createArtifact] Creating: ${type}`);
    const gltfModel = await modelLoader.loadModel(type);
    if (gltfModel) {
        console.log(`[createArtifact] ✓ Got GLTF model for: ${type}`);
        return gltfModel;
    }
    console.log(`[createArtifact] ✗ Using procedural fallback for: ${type}`);
    return createProceduralArtifact(type);
}

function createProceduralArtifact(type) {
    const artifacts = {
        pyramid: () => new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.5, 4), new THREE.MeshStandardMaterial({ color: 0xd4a574 })),
        sphinx: () => new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.2), new THREE.MeshStandardMaterial({ color: 0xd4a574 })),
        ankh: () => new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 8, 16), new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8 })),
        scarab: () => new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), new THREE.MeshStandardMaterial({ color: 0x2e8b57 })),
        pharaoh_mask: () => new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.35, 0.2), new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.9 })),
        column: () => new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.5, 12), new THREE.MeshStandardMaterial({ color: 0xf5f5dc })),
        amphora: () => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 12), new THREE.MeshStandardMaterial({ color: 0xcd853f })); m.scale.y = 1.5; return m; },
        helmet: () => new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xb8860b, metalness: 0.8 })),
        olive_branch: () => new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.4, 8), new THREE.MeshStandardMaterial({ color: 0x556b2f })),
        coin_greek: () => new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.02, 24), new THREE.MeshStandardMaterial({ color: 0xc0c0c0, metalness: 0.9 })),
        dragon: () => new THREE.Mesh(new THREE.TorusKnotGeometry(0.12, 0.04, 64, 8), new THREE.MeshStandardMaterial({ color: 0xff4500 })),
        pagoda: () => new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.4, 6), new THREE.MeshStandardMaterial({ color: 0x8b0000 })),
        terracotta: () => new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.4, 8), new THREE.MeshStandardMaterial({ color: 0xcd853f })),
        jade: () => {
            const group = new THREE.Group();
            const jadeMat = new THREE.MeshStandardMaterial({
                color: 0x00a86b,
                roughness: 0.3,
                metalness: 0.1
            });
            // Main jade piece
            const main = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), jadeMat);
            main.scale.set(1, 1.3, 0.6);
            group.add(main);
            // Small accent
            const accent = new THREE.Mesh(new THREE.OctahedronGeometry(0.05), jadeMat);
            accent.position.set(0.08, 0.1, 0);
            group.add(accent);
            return group;
        },
        lantern: () => new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0x330000 })),
        aztec_calendar: () => new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.05, 32), new THREE.MeshStandardMaterial({ color: 0x8b7355 })),
        pyramid_mayan: () => new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.35, 4), new THREE.MeshStandardMaterial({ color: 0xa0522d })),
        jaguar: () => new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.12), new THREE.MeshStandardMaterial({ color: 0xffa500 })),
        maize: () => new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.25, 8), new THREE.MeshStandardMaterial({ color: 0xffd700 })),
        obsidian: () => new THREE.Mesh(new THREE.OctahedronGeometry(0.15), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.9 })),
        torii: () => new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.05), new THREE.MeshStandardMaterial({ color: 0xff0000 })),
        samurai_helmet: () => new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2f2f2f, metalness: 0.9 })),
        katana: () => new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.4, 0.01), new THREE.MeshStandardMaterial({ color: 0xc0c0c0, metalness: 1 })),
        cherry_blossom: () => new THREE.Mesh(new THREE.IcosahedronGeometry(0.12), new THREE.MeshStandardMaterial({ color: 0xffb7c5 })),
        daruma: () => new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 12), new THREE.MeshStandardMaterial({ color: 0xff0000 }))
    };

    const createFunc = artifacts[type];
    if (createFunc) {
        const mesh = createFunc();
        mesh.castShadow = true;
        return mesh;
    }

    return new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.2, 0.2),
        new THREE.MeshStandardMaterial({ color: 0x888888 })
    );
}

// ============================================
// DEBUG MENU
// ============================================

function setupDebugMenu() {
    const debugToggle = document.getElementById('debug-toggle');
    const debugMenu = document.getElementById('debug-menu');
    const countryList = document.getElementById('debug-country-list');
    const wallhackToggle = document.getElementById('wallhack-toggle');

    // Toggle debug menu
    debugToggle.addEventListener('click', () => {
        debugMenu.classList.toggle('show');
    });

    // Populate country buttons
    COUNTRIES.forEach((country, index) => {
        const btn = document.createElement('button');
        btn.className = 'debug-country-btn';
        btn.textContent = `${index + 1}. ${country.name}`;
        btn.dataset.countryIndex = index;
        btn.addEventListener('click', () => loadCountryForDebug(index));
        countryList.appendChild(btn);
    });

    // Wallhack toggle
    wallhackToggle.addEventListener('change', (e) => {
        wallhackEnabled = e.target.checked;
        updateWallhackMarkers();
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#debug-panel')) {
            debugMenu.classList.remove('show');
        }
    });
}

async function loadCountryForDebug(countryIndex) {
    const debugMenu = document.getElementById('debug-menu');
    debugMenu.classList.remove('show');

    // Update active button
    document.querySelectorAll('.debug-country-btn').forEach((btn, i) => {
        btn.classList.toggle('active', i === countryIndex);
    });

    // Reset game state
    artifactsFound = 0;

    // Remove old particles
    const toRemove = [];
    scene.traverse(obj => {
        if (obj.userData.isParticle) toRemove.push(obj);
    });
    toRemove.forEach(p => {
        scene.remove(p);
        if (p.geometry) p.geometry.dispose();
        if (p.material) p.material.dispose();
    });

    // Remove old artifacts
    artifacts.forEach(a => {
        scene.remove(a.mesh);
    });
    artifacts = [];

    // Load selected country
    currentCountry = COUNTRIES[countryIndex];
    console.log(`[DEBUG] Loading country: ${currentCountry.name}`);

    // Create platform and artifacts
    createDigPlatform(currentCountry);
    await placeArtifacts(currentCountry);

    // Reset UI
    document.getElementById('guess-btn').style.display = 'block';
    document.getElementById('next-round-btn').style.display = 'none';
    document.getElementById('country-input').value = '';
    updateUI();

    // Show confirmation
    const message = document.getElementById('message');
    message.textContent = `Testing: ${currentCountry.name}`;
    message.className = 'show';
    setTimeout(() => message.classList.remove('show'), 1500);

    // Reset camera
    camera.position.set(0, 6, 8);
    controls.target.set(0, 1, 0);

    // Update wallhack if enabled
    if (wallhackEnabled) {
        updateWallhackMarkers();
    }
}

function updateWallhackMarkers() {
    // Remove existing markers
    wallhackMarkers.forEach(marker => {
        scene.remove(marker);
        if (marker.geometry) marker.geometry.dispose();
        if (marker.material) marker.material.dispose();
    });
    wallhackMarkers = [];

    if (!wallhackEnabled) return;

    // Create markers for each hidden artifact
    artifacts.forEach((artifact, index) => {
        if (artifact.revealed) return;

        // Use the artifact's actual surface height
        const surfaceY = artifact.surfaceHeight || 1.0;

        // Glowing ring marker on top of terrain surface
        const ringGeo = new THREE.RingGeometry(0.25, 0.35, 32);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0xff00ff,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.8
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.set(artifact.position.x, surfaceY + 0.1, artifact.position.y);
        ring.rotation.x = -Math.PI / 2;
        ring.userData.isWallhackMarker = true;
        scene.add(ring);
        wallhackMarkers.push(ring);

        // Vertical beam going down to show depth
        const beamHeight = artifact.revealDepth + 0.5;
        const beamGeo = new THREE.CylinderGeometry(0.03, 0.03, beamHeight, 8);
        const beamMat = new THREE.MeshBasicMaterial({
            color: 0xff00ff,
            transparent: true,
            opacity: 0.4
        });
        const beam = new THREE.Mesh(beamGeo, beamMat);
        beam.position.set(artifact.position.x, surfaceY - beamHeight / 2, artifact.position.y);
        beam.userData.isWallhackMarker = true;
        scene.add(beam);
        wallhackMarkers.push(beam);

        // Depth label (small sphere at artifact location)
        const sphereGeo = new THREE.SphereGeometry(0.1, 16, 16);
        const sphereMat = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.9
        });
        const sphere = new THREE.Mesh(sphereGeo, sphereMat);
        sphere.position.set(artifact.position.x, surfaceY - artifact.revealDepth, artifact.position.y);
        sphere.userData.isWallhackMarker = true;
        scene.add(sphere);
        wallhackMarkers.push(sphere);
    });

    console.log(`[DEBUG] Wallhack: showing ${wallhackMarkers.length / 3} artifact locations`);
}

// ============================================
// UI SYSTEM
// ============================================

function setupUI() {
    document.getElementById('guess-btn').addEventListener('click', makeGuess);
    document.getElementById('next-round-btn').addEventListener('click', startNewRound);

    // Debug menu setup
    setupDebugMenu();

    const input = document.getElementById('country-input');
    const autocomplete = document.getElementById('autocomplete');

    input.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            makeGuess();
            return;
        }

        const value = input.value.toLowerCase();
        if (value.length < 2) {
            autocomplete.classList.remove('show');
            return;
        }

        const matches = ALL_COUNTRIES.filter(c =>
            c.toLowerCase().includes(value)
        ).slice(0, 5);

        if (matches.length > 0) {
            autocomplete.innerHTML = matches.map(m =>
                `<div class="autocomplete-item">${m}</div>`
            ).join('');
            autocomplete.classList.add('show');

            autocomplete.querySelectorAll('.autocomplete-item').forEach(item => {
                item.addEventListener('click', () => {
                    input.value = item.textContent;
                    autocomplete.classList.remove('show');
                });
            });
        } else {
            autocomplete.classList.remove('show');
        }
    });

    input.addEventListener('blur', () => {
        setTimeout(() => autocomplete.classList.remove('show'), 200);
    });
}

function updateUI() {
    document.getElementById('artifacts-found').textContent =
        `Artifacts: ${artifactsFound}/${totalArtifacts}`;
    document.getElementById('points-value').textContent = getPointsForCurrentState();
}

function getPointsForCurrentState() {
    if (artifactsFound <= 1) return 500;
    if (artifactsFound === 2) return 400;
    if (artifactsFound === 3) return 300;
    if (artifactsFound === 4) return 200;
    return 100;
}

function makeGuess() {
    if (hasGuessedThisRound) return; // Prevent double guessing

    const input = document.getElementById('country-input');
    const guess = input.value.trim().toLowerCase();
    const correct = currentCountry.name.toLowerCase();
    const message = document.getElementById('message');

    if (!guess) return; // Don't allow empty guesses

    hasGuessedThisRound = true;

    // Stop timer
    if (roundTimer) {
        clearInterval(roundTimer);
        roundTimer = null;
    }

    totalGuesses++;

    // Submit guess to server if multiplayer
    if (isMultiplayerGame()) {
        submitMultiplayerGuess(input.value.trim());
    }

    const isCorrect = guess === correct;

    if (isCorrect) {
        // Calculate points based on artifacts found and time
        const points = getPointsForCorrectGuess();
        score += points;
        correctGuesses++;
        message.textContent = `CORRECT! +${points}`;
        message.className = 'correct show';
        document.getElementById('score-value').textContent = score;
        audioManager.playCorrect();
    } else {
        score = Math.max(0, score - 100);
        message.textContent = `WRONG! It was ${currentCountry.name}`;
        message.className = 'wrong show';
        document.getElementById('score-value').textContent = score;
        audioManager.playIncorrect();
    }

    setTimeout(() => message.classList.remove('show'), 2000);

    // Track total artifacts found
    totalArtifactsFoundGame += artifactsFound;

    // Update global score for game over screen
    window.gameScore = score;

    // Disable input after guessing
    input.value = '';
    input.disabled = true;
    document.getElementById('guess-btn').style.display = 'none';

    // In multiplayer, show waiting overlay
    if (gameSettings.isMultiplayer && window.showGuessedOverlay) {
        window.showGuessedOverlay(isCorrect);
        // Don't proceed until server says round is over
    } else {
        // Solo mode - show results after brief delay
        setTimeout(() => {
            showRoundEndResults(isCorrect, false);
        }, 1500);
    }
}

// ============================================
// GAME FLOW
// ============================================

async function startNewRound() {
    currentRound++;
    artifactsFound = 0;
    hasGuessedThisRound = false;

    // Show loading screen
    showRoundLoading(true);

    // Hide any overlays
    if (window.hideGuessedOverlay) window.hideGuessedOverlay();
    if (window.hideRoundResults) window.hideRoundResults();

    // Update round display
    const roundDisplay = document.getElementById('round-display');
    if (roundDisplay) {
        roundDisplay.textContent = `Round ${currentRound}/${totalRounds}`;
    }

    // Remove old particles
    const toRemove = [];
    scene.traverse(obj => {
        if (obj.userData.isParticle) toRemove.push(obj);
    });
    toRemove.forEach(p => {
        scene.remove(p);
        if (p.geometry) p.geometry.dispose();
        if (p.material) p.material.dispose();
    });

    // Remove old artifacts
    artifacts.forEach(a => {
        scene.remove(a.mesh);
    });
    artifacts = [];

    // Clear wallhack markers
    wallhackMarkers.forEach(marker => {
        scene.remove(marker);
        if (marker.geometry) marker.geometry.dispose();
        if (marker.material) marker.material.dispose();
    });
    wallhackMarkers = [];

    // Pick random country
    currentCountry = COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)];

    // Create platform and artifacts
    createDigPlatform(currentCountry);
    await placeArtifacts(currentCountry);

    // Hide loading screen
    showRoundLoading(false);

    // Show tutorial on first round if not completed
    if (currentRound === 1 && tutorial.shouldShow()) {
        tutorial.start(() => {
            // Start timer after tutorial ends
            startRoundTimer();
        });
    } else {
        // Reset and start timer (after loading is done)
        startRoundTimer();
    }

    // Reset UI
    document.getElementById('guess-btn').style.display = 'block';
    document.getElementById('next-round-btn').style.display = 'none';
    document.getElementById('country-input').value = '';
    document.getElementById('country-input').disabled = false;
    updateUI();

    // Reset camera
    camera.position.set(0, 6, 8);
    controls.target.set(0, 1, 0);

    // Update wallhack if enabled
    if (wallhackEnabled) {
        updateWallhackMarkers();
    }
}

/**
 * Show/hide round loading screen
 */
function showRoundLoading(show) {
    let overlay = document.getElementById('round-loading-overlay');

    if (!overlay) {
        // Create loading overlay matching main menu EXACTLY
        overlay = document.createElement('div');
        overlay.id = 'round-loading-overlay';
        overlay.innerHTML = `
            <!-- Background -->
            <div class="loading-menu-background"></div>
            
            <!-- Particles -->
            <div class="loading-particles-container" id="loading-particles"></div>
            
            <!-- Terrain at bottom -->
            <div class="loading-terrain-decoration"></div>
            
            <!-- Floating artifacts -->
            <div class="loading-floating-artifacts">
                <div class="loading-floating-artifact">🏛️</div>
                <div class="loading-floating-artifact">🏺</div>
                <div class="loading-floating-artifact">⚱️</div>
                <div class="loading-floating-artifact">🗿</div>
                <div class="loading-floating-artifact">🏺</div>
                <div class="loading-floating-artifact">🗝️</div>
                <div class="loading-floating-artifact">⚔️</div>
                <div class="loading-floating-artifact">👑</div>
            </div>
            
            <!-- Vignette -->
            <div class="loading-vignette"></div>
            
            <!-- Corner decorations -->
            <div class="loading-corner-decoration loading-corner-tl"></div>
            <div class="loading-corner-decoration loading-corner-tr"></div>
            <div class="loading-corner-decoration loading-corner-bl"></div>
            <div class="loading-corner-decoration loading-corner-br"></div>
            
            <!-- Torches -->
            <div class="loading-torch loading-torch-left">
                <div class="loading-torch-glow loading-torch-glow-left"></div>
                <div class="loading-torch-flame">🔥</div>
                <div class="loading-torch-handle"></div>
            </div>
            <div class="loading-torch loading-torch-right">
                <div class="loading-torch-glow loading-torch-glow-right"></div>
                <div class="loading-torch-flame">🔥</div>
                <div class="loading-torch-handle"></div>
            </div>
            
            <!-- Main content -->
            <div class="loading-menu-content">
                <div class="loading-pickaxe-icon">⛏️</div>
                <h1 class="loading-game-title">UNEARTH</h1>
                <p class="loading-game-tagline">DIG DEEP • DISCOVER HISTORY</p>
                
                <div class="loading-divider-line">
                    <span></span>
                    <span></span>
                </div>
                
                <div class="loading-spinner-box">
                    <div class="loading-spinner-ring"></div>
                </div>
                
                <p class="loading-status-text">Preparing excavation site...</p>
            </div>
        `;
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 999;
            opacity: 1;
            transition: opacity 0.4s ease;
            overflow: hidden;
        `;

        // Add styles matching main menu EXACTLY
        const style = document.createElement('style');
        style.id = 'loading-screen-styles';
        style.textContent = `
            /* Background */
            .loading-menu-background {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: 
                    radial-gradient(ellipse at 20% 80%, rgba(139, 90, 43, 0.15) 0%, transparent 50%),
                    radial-gradient(ellipse at 80% 20%, rgba(184, 134, 11, 0.1) 0%, transparent 50%),
                    radial-gradient(ellipse at 50% 50%, rgba(30, 20, 10, 0.8) 0%, transparent 70%),
                    linear-gradient(180deg, #0d0906 0%, #1a120a 50%, #0d0906 100%);
                z-index: 1;
            }

            /* Particles */
            .loading-particles-container {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 2;
                overflow: hidden;
                pointer-events: none;
            }

            .loading-particle {
                position: absolute;
                background: radial-gradient(circle, rgba(218, 165, 32, 0.8) 0%, rgba(218, 165, 32, 0) 70%);
                border-radius: 50%;
                pointer-events: none;
                animation: loading-float-particle linear infinite;
            }

            @keyframes loading-float-particle {
                0% {
                    transform: translateY(100vh) rotate(0deg);
                    opacity: 0;
                }
                10% { opacity: 1; }
                90% { opacity: 1; }
                100% {
                    transform: translateY(-100px) rotate(720deg);
                    opacity: 0;
                }
            }

            /* Terrain at bottom */
            .loading-terrain-decoration {
                position: absolute;
                bottom: 0;
                left: 0;
                width: 100%;
                height: 200px;
                background: linear-gradient(180deg, transparent 0%, rgba(62, 39, 18, 0.4) 50%, rgba(62, 39, 18, 0.8) 100%);
                z-index: 3;
                pointer-events: none;
            }

            /* Floating artifacts */
            .loading-floating-artifacts {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 4;
                pointer-events: none;
            }

            .loading-floating-artifact {
                position: absolute;
                font-size: 40px;
                opacity: 0.12;
                animation: loading-float-artifact 20s ease-in-out infinite;
                filter: grayscale(0.5);
            }

            .loading-floating-artifact:nth-child(1) { top: 12%; left: 8%; animation-delay: 0s; animation-duration: 25s; }
            .loading-floating-artifact:nth-child(2) { top: 65%; left: 5%; animation-delay: -5s; animation-duration: 22s; }
            .loading-floating-artifact:nth-child(3) { top: 20%; right: 10%; animation-delay: -10s; animation-duration: 28s; }
            .loading-floating-artifact:nth-child(4) { top: 75%; right: 8%; animation-delay: -15s; animation-duration: 24s; }
            .loading-floating-artifact:nth-child(5) { top: 40%; left: 12%; animation-delay: -8s; animation-duration: 26s; }
            .loading-floating-artifact:nth-child(6) { top: 85%; left: 30%; animation-delay: -12s; animation-duration: 23s; }
            .loading-floating-artifact:nth-child(7) { top: 30%; right: 15%; animation-delay: -3s; animation-duration: 27s; }
            .loading-floating-artifact:nth-child(8) { top: 55%; right: 20%; animation-delay: -18s; animation-duration: 21s; }

            @keyframes loading-float-artifact {
                0%, 100% { transform: translateY(0) rotate(0deg) scale(1); }
                25% { transform: translateY(-20px) rotate(5deg) scale(1.05); }
                50% { transform: translateY(-10px) rotate(-3deg) scale(1); }
                75% { transform: translateY(-25px) rotate(3deg) scale(1.02); }
            }

            /* Vignette */
            .loading-vignette {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: radial-gradient(ellipse at center, transparent 0%, transparent 40%, rgba(0,0,0,0.7) 100%);
                z-index: 5;
                pointer-events: none;
            }

            /* Corner decorations */
            .loading-corner-decoration {
                position: absolute;
                width: 80px;
                height: 80px;
                border: 2px solid rgba(201, 162, 39, 0.3);
                z-index: 10;
                pointer-events: none;
            }

            .loading-corner-tl { top: 20px; left: 20px; border-right: none; border-bottom: none; }
            .loading-corner-tr { top: 20px; right: 20px; border-left: none; border-bottom: none; }
            .loading-corner-bl { bottom: 20px; left: 20px; border-right: none; border-top: none; }
            .loading-corner-br { bottom: 20px; right: 20px; border-left: none; border-top: none; }

            /* Torches */
            .loading-torch {
                position: absolute;
                bottom: 120px;
                z-index: 10;
            }

            .loading-torch-left { left: 40px; }
            .loading-torch-right { right: 40px; }

            .loading-torch-flame {
                font-size: 35px;
                animation: loading-flame-flicker 0.3s ease-in-out infinite alternate;
                filter: brightness(1.2);
            }

            .loading-torch-handle {
                width: 8px;
                height: 70px;
                background: linear-gradient(180deg, #5c3d1e 0%, #3d2612 100%);
                border-radius: 2px;
                margin: -5px auto 0;
            }

            @keyframes loading-flame-flicker {
                0% { transform: scale(1) rotate(-3deg); filter: brightness(1); }
                100% { transform: scale(1.1) rotate(3deg); filter: brightness(1.3); }
            }

            .loading-torch-glow {
                position: absolute;
                bottom: 80px;
                width: 180px;
                height: 180px;
                background: radial-gradient(ellipse at center, rgba(255, 150, 50, 0.25) 0%, transparent 70%);
                pointer-events: none;
                animation: loading-glow-pulse 2s ease-in-out infinite;
            }

            .loading-torch-glow-left { left: -50px; }
            .loading-torch-glow-right { right: -50px; }

            @keyframes loading-glow-pulse {
                0%, 100% { opacity: 0.6; transform: scale(1); }
                50% { opacity: 1; transform: scale(1.1); }
            }

            /* Main Content */
            .loading-menu-content {
                position: relative;
                z-index: 20;
                text-align: center;
            }

            .loading-pickaxe-icon {
                font-size: 50px;
                margin-bottom: 10px;
                animation: loading-pickaxe-swing 1.5s ease-in-out infinite;
                display: inline-block;
            }

            @keyframes loading-pickaxe-swing {
                0%, 100% { transform: rotate(-15deg); }
                50% { transform: rotate(15deg); }
            }

            .loading-game-title {
                font-family: 'Cinzel', 'Times New Roman', serif;
                font-size: 72px;
                font-weight: 400;
                letter-spacing: 25px;
                color: #c9a227;
                margin: 0 0 10px 0;
                text-shadow: 0 0 40px rgba(201, 162, 39, 0.4);
                text-indent: 25px;
            }

            .loading-game-tagline {
                font-family: 'Cinzel', 'Times New Roman', serif;
                font-size: 14px;
                letter-spacing: 8px;
                color: #8a7355;
                margin: 0 0 30px 0;
                text-transform: uppercase;
            }

            .loading-divider-line {
                display: flex;
                justify-content: center;
                gap: 15px;
                margin-bottom: 35px;
            }

            .loading-divider-line span {
                width: 100px;
                height: 2px;
                background: linear-gradient(90deg, transparent, #c9a227, transparent);
            }

            .loading-spinner-box {
                margin-bottom: 25px;
            }

            .loading-spinner-ring {
                width: 45px;
                height: 45px;
                border: 3px solid rgba(201, 162, 39, 0.2);
                border-top: 3px solid #c9a227;
                border-radius: 50%;
                margin: 0 auto;
                animation: loading-spin 1s linear infinite;
            }

            @keyframes loading-spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }

            .loading-status-text {
                font-family: 'Cinzel', 'Times New Roman', serif;
                font-size: 16px;
                letter-spacing: 4px;
                color: #c9a227;
                margin: 0;
                text-transform: uppercase;
                animation: loading-pulse 2s ease-in-out infinite;
            }

            @keyframes loading-pulse {
                0%, 100% { opacity: 0.5; }
                50% { opacity: 1; }
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(overlay);

        // Create particles
        createLoadingParticles();
    }

    if (show) {
        overlay.style.display = 'flex';
        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
        });
        // Recreate particles each time
        createLoadingParticles();
    } else {
        overlay.style.opacity = '0';
        setTimeout(() => {
            overlay.style.display = 'none';
        }, 400);
    }
}

/**
 * Create floating particles for loading screen
 */
function createLoadingParticles() {
    const container = document.getElementById('loading-particles');
    if (!container) return;

    container.innerHTML = '';

    for (let i = 0; i < 30; i++) {
        const particle = document.createElement('div');
        particle.className = 'loading-particle';

        const size = Math.random() * 6 + 2;
        const left = Math.random() * 100;
        const duration = Math.random() * 15 + 10;
        const delay = Math.random() * 15;

        particle.style.cssText = `
            width: ${size}px;
            height: ${size}px;
            left: ${left}%;
            animation-duration: ${duration}s;
            animation-delay: -${delay}s;
        `;

        container.appendChild(particle);
    }
}

// ============================================
// TIMER FUNCTIONS
// ============================================

function startRoundTimer() {
    if (gameSettings.timePerRound === 0) {
        const timerEl = document.getElementById('timer-display');
        if (timerEl) timerEl.textContent = '∞';
        return;
    }

    timeRemaining = gameSettings.timePerRound;
    updateTimerDisplay();

    if (roundTimer) clearInterval(roundTimer);

    roundTimer = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();

        // Use the global function for visual feedback
        if (window.updateTimer) {
            window.updateTimer(timeRemaining);
        }

        if (timeRemaining <= 0) {
            clearInterval(roundTimer);
            roundTimer = null;
            handleTimeUp();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const timerEl = document.getElementById('timer-display');
    if (!timerEl) return;

    const mins = Math.floor(timeRemaining / 60);
    const secs = timeRemaining % 60;
    timerEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;

    // Warning when low on time
    if (timeRemaining <= 10) {
        timerEl.classList.add('warning');
    } else {
        timerEl.classList.remove('warning');
    }
}

function handleTimeUp() {
    if (hasGuessedThisRound) return; // Already guessed

    hasGuessedThisRound = true;
    totalGuesses++;

    // Show the correct answer
    const message = document.getElementById('message');
    message.textContent = `Time's up! It was ${currentCountry.name}`;
    message.className = 'wrong show';
    audioManager.playIncorrect();
    setTimeout(() => message.classList.remove('show'), 2000);

    // Track artifacts found this round
    totalArtifactsFoundGame += artifactsFound;

    // Disable input
    document.getElementById('country-input').disabled = true;
    document.getElementById('guess-btn').style.display = 'none';

    // Show between-round results
    showRoundEndResults(false, true); // wrong, timeout
}

function getPointsForCorrectGuess() {
    // Base points decrease as you find more artifacts (incentive to guess early)
    let basePoints;
    if (artifactsFound <= 1) basePoints = 500;
    else if (artifactsFound === 2) basePoints = 400;
    else if (artifactsFound === 3) basePoints = 300;
    else if (artifactsFound === 4) basePoints = 200;
    else basePoints = 100;

    // Time bonus: 1 point per second remaining
    const timeBonus = Math.floor(timeRemaining);

    return basePoints + timeBonus;
}

function showRoundEndResults(wasCorrect, wasTimeout) {
    // For solo mode, create simple results
    const points = wasCorrect ? getPointsForCorrectGuess() : (wasTimeout ? 0 : -100);
    const playerResults = [{
        name: 'You',
        correct: wasCorrect,
        timeout: wasTimeout,
        points: points
    }];

    if (window.showRoundResults) {
        window.showRoundResults({
            correctAnswer: currentCountry.name,
            playerResults: playerResults
        });
    }

    // After 5 seconds (matching the overlay countdown), advance to next round
    setTimeout(() => {
        if (window.hideRoundResults) window.hideRoundResults();
        checkGameEnd();
    }, 5000);
}

function checkGameEnd() {
    if (currentRound >= totalRounds) {
        // Game over - show final results
        showFinalResults();
    } else {
        // Continue to next round
        startNewRound();
    }
}

function showFinalResults() {
    // Use the global function from index.html
    if (window.showGameResults) {
        window.showGameResults({
            yourScore: score,
            correctGuesses: correctGuesses,
            totalGuesses: totalGuesses,
            totalArtifacts: totalArtifactsFoundGame
        });
    }

    // Show game over screen
    const gameOverEl = document.getElementById('game-over');
    if (gameOverEl) {
        gameOverEl.style.display = 'flex';
    }
}

// ============================================
// RENDER LOOP
// ============================================

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// ============================================
// MULTIPLAYER HANDLERS
// ============================================

// Called when another player guesses
window.onMultiplayerPlayerGuessed = function(data) {
    if (window.showGuessNotification) {
        window.showGuessNotification(data.playerName, data.isCorrect);
    }
};

// Called by menuController when server sends round start
window.onMultiplayerRoundStart = async (message) => {
    // Show loading screen
    showRoundLoading(true);

    // Set the country from server
    currentCountry = COUNTRIES.find(c => c.name === message.country) || COUNTRIES[0];
    currentRound = message.round;
    totalRounds = message.totalRounds;

    // Reset round state
    artifactsFound = 0;
    hasGuessedThisRound = false;

    // Hide any overlays
    if (window.hideGuessedOverlay) window.hideGuessedOverlay();
    if (window.hideRoundResults) window.hideRoundResults();

    // Remove old particles
    const toRemove = [];
    scene.traverse(obj => {
        if (obj.userData.isParticle) toRemove.push(obj);
    });
    toRemove.forEach(p => {
        scene.remove(p);
        if (p.geometry) p.geometry.dispose();
        if (p.material) p.material.dispose();
    });

    // Remove old artifacts
    artifacts.forEach(a => {
        scene.remove(a.mesh);
    });
    artifacts = [];

    // Create new terrain and artifacts
    createDigPlatform(currentCountry);
    await placeArtifacts(currentCountry);

    // Hide loading screen
    showRoundLoading(false);

    // Start timer
    startRoundTimer();

    // Update UI
    const roundDisplay = document.getElementById('round-display');
    if (roundDisplay) {
        roundDisplay.textContent = `Round ${currentRound}/${totalRounds}`;
    }
    document.getElementById('guess-btn').style.display = 'block';
    document.getElementById('next-round-btn').style.display = 'none';
    document.getElementById('country-input').value = '';
    document.getElementById('country-input').disabled = false;
    updateUI();
};

// Called when round ends (server triggered)
window.onMultiplayerRoundEnd = function(data) {
    // Hide guessed overlay
    if (window.hideGuessedOverlay) window.hideGuessedOverlay();

    // Show round results with all player scores
    if (window.showRoundResults) {
        window.showRoundResults({
            correctAnswer: data.correctAnswer,
            playerResults: data.results ? data.results.map(r => ({
                name: r.playerName,
                correct: r.isCorrect,
                timeout: r.isTimeout,
                points: r.points
            })) : []
        });
    }

    // After showing results, request next round (if not game over)
    if (!data.isGameOver) {
        setTimeout(() => {
            if (window.hideRoundResults) window.hideRoundResults();
            // Request next round from server
            if (window.lobbyManager) {
                window.lobbyManager.send('request_next_round');
            }
        }, 5000);
    }
};

// Called when game ends
window.onMultiplayerGameEnd = function(data) {
    if (window.showGameResults) {
        window.showGameResults({
            standings: data.standings,
            yourScore: score,
            correctGuesses: correctGuesses,
            totalGuesses: totalGuesses,
            totalArtifacts: totalArtifactsFoundGame
        });
    }

    const gameOverEl = document.getElementById('game-over');
    if (gameOverEl) {
        gameOverEl.style.display = 'flex';
    }
};

// Initialize game function for menu controller
window.initGame = function(settings) {
    gameSettings = settings;
    totalRounds = settings.rounds;
    currentRound = 0;
    correctGuesses = 0;
    totalGuesses = 0;
    totalArtifactsFoundGame = 0;
    score = 0;

    // Reset artifact service for new game
    artifactService.reset();

    document.getElementById('score-value').textContent = '0';

    // Hide game over screen
    const gameOverEl = document.getElementById('game-over');
    if (gameOverEl) {
        gameOverEl.style.display = 'none';
    }

    // Start first round
    startNewRound();
};

// Export score for game over screen
window.gameScore = 0;

// Expose tutorial to window for menu access
window.tutorial = tutorial;
window.startTutorial = () => tutorial.start();
window.resetTutorial = () => tutorial.reset();

// ============================================
// START
// ============================================

init();