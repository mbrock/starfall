// The renderer, scene, camera and lights everything else draws into.
import * as THREE from 'three';
import { $, coarse, slowGPU } from '../platform.js';

export const renderer = new THREE.WebGLRenderer({ antialias: !slowGPU });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
$('game').appendChild(renderer.domElement);
export const canvas = renderer.domElement;

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0a1f);
export const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 600);

export const hemi = new THREE.HemisphereLight(0xb4c0ff, 0x3a2148, 1.15);
scene.add(hemi);
export const sun = new THREE.DirectionalLight(0xffe4bd, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024); // 2048 cost ~7 ms more GPU time per frame on the Pi 5 (V3D)
Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 90 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

export function resizeStage() {
  camera.aspect = innerWidth / innerHeight;
  // A little more peripheral vision on a tall phone, without changing desktop framing.
  camera.fov = coarse && camera.aspect < 1 ? 70 : 55;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
