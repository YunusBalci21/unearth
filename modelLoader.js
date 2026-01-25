// ============================================
// MODEL LOADER - With size normalization
// ============================================

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three';

// Maximum size for any artifact (in world units)
const MAX_ARTIFACT_SIZE = 0.8;

// Model paths mapped to artifact types
export const ARTIFACT_MODELS = {
    // ========== EGYPT ==========
    pyramid: './public/models/pyramid_and_the_sphinx.glb',
    sphinx: './public/models/the_great_sphinx_of_giza_-_egypt.glb',
    ankh: './public/models/ankh_asset.glb',
    scarab: './public/models/giant_sculpture_of_a_scarab_beetle.glb',
    pharaoh_mask: './public/models/tutankhamun_gold_mask.glb',

    // ========== GREECE ==========
    column: './public/models/ionic_column.glb',
    amphora: './public/models/ancient_greek_amphora.glb',
    helmet: './public/models/pbr_corinthian_helmet.glb',
    pottery: './public/models/ancient_greek_pottery.glb',
    coin_greek: './public/models/greek_bronze_coin.glb',

    // ========== CHINA ==========
    dragon: './public/models/chinese_dragon.glb',
    pagoda: './public/models/chinese_pagoda_low_poly.glb',
    terracotta: './public/models/terracotta_warrior_3_3dst40.glb',
    terracotta2: './public/models/terracotta_warrior_4_-_high_resolution.glb',
    temple: './public/models/chinese_temple.glb',

    // ========== MEXICO ==========
    aztec_calendar: './public/models/aztec_calendar_stone_cast.glb',
    pyramid_mayan: './public/models/mayan_pyramid.glb',
    mictlantecuhtli: './public/models/figure_of_mictlantecuhtli.glb',
    sun_stone: './public/models/aztec_sun_stone.glb',
    chichen_itza: './public/models/chichen_itza_pyramid_3d_reconstruction.glb',

    // ========== JAPAN ==========
    torii: './public/models/torii_gate.glb',
    torii_abandoned: './public/models/abandoned_torii_gate.glb',
    katana: './public/models/katana._samurai_sword._blender_sword._simple..glb',
    daruma: './public/models/daruma.glb'
};

class ModelLoader {
    constructor() {
        this.loader = new GLTFLoader();
        this.cache = new Map();
    }

    async loadModel(artifactType) {
        const path = ARTIFACT_MODELS[artifactType];
        
        if (!path) {
            console.warn(`[ModelLoader] No path for: ${artifactType}`);
            return null;
        }

        // Check cache first
        if (this.cache.has(artifactType)) {
            return this.cloneModel(this.cache.get(artifactType));
        }

        try {
            const gltf = await this.loader.loadAsync(path);
            const scene = gltf.scene;
            
            // Enable shadows
            scene.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            // Normalize size
            const box = new THREE.Box3().setFromObject(scene);
            const size = new THREE.Vector3();
            box.getSize(size);
            const maxDim = Math.max(size.x, size.y, size.z);
            
            if (maxDim > 0) {
                const scale = MAX_ARTIFACT_SIZE / maxDim;
                scene.scale.multiplyScalar(scale);
            }

            // Recalculate bounds after scaling
            box.setFromObject(scene);
            const center = new THREE.Vector3();
            box.getCenter(center);

            // Center horizontally, align bottom to y=0
            scene.position.x -= center.x;
            scene.position.z -= center.z;
            scene.position.y -= box.min.y; // Use box.min.y directly

            // Wrap in a group
            const wrapper = new THREE.Group();
            wrapper.add(scene);
            
            // Cache it
            this.cache.set(artifactType, wrapper);
            console.log(`[ModelLoader] ✓ Loaded: ${artifactType}`);

            // Return a deep clone
            return this.cloneModel(wrapper);
            
        } catch (error) {
            console.error(`[ModelLoader] ✗ Failed: ${artifactType}`, error);
            return null;
        }
    }

    // Deep clone a model with all children
    cloneModel(model) {
        const clone = model.clone(true); // true = recursive
        
        // Clone materials to avoid shared material issues
        clone.traverse((child) => {
            if (child.isMesh) {
                if (Array.isArray(child.material)) {
                    child.material = child.material.map(m => m.clone());
                } else if (child.material) {
                    child.material = child.material.clone();
                }
            }
        });
        
        return clone;
    }

    async preloadAll() {
        const types = Object.keys(ARTIFACT_MODELS);
        console.log(`[ModelLoader] Preloading ${types.length} models...`);

        let loaded = 0;
        let failed = 0;

        for (const type of types) {
            const model = await this.loadModel(type);
            if (model) {
                loaded++;
            } else {
                failed++;
            }
        }

        console.log(`[ModelLoader] Complete: ${loaded} loaded, ${failed} failed`);
    }
}

export const modelLoader = new ModelLoader();
