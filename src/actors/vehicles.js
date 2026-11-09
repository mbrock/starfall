// Models for travelling between bodies (game/travel*.js): the rocket and its launch pad, the comet, the jet
// nozzles on Pip's skateboard, beacon beams, and the rocks and motes floating in space. Models only; the
// travel modules move them.
import * as THREE from 'three';
import { glowMaterial, glowSprite, mat } from '../engine/materials.js';
import { board } from './pip.js';

const M = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; return o; };
const additive = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const white = mat(0xf4f0ff), red = mat(0xff5a6e), dark = mat(0x3a3570), stone = mat(0x9a96b8);

/** A cone of flame along -y from the origin; scale.y sets its length. */
function flame(radius, color) {
  const g = new THREE.Group();
  const outer = new THREE.Mesh(new THREE.ConeGeometry(radius, 1, 10, 1, true).rotateX(Math.PI).translate(0, -0.5, 0), additive(color, 0.75));
  const inner = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.5, 0.7, 8, 1, true).rotateX(Math.PI).translate(0, -0.35, 0), additive(0xfff4d0, 0.9));
  g.add(outer, inner, glowSprite(color, radius * 6));
  return g;
}

/** Pip's rocket, standing on its tail at y = 0. flame (scale.y = thrust) hangs under the nozzle. */
export function makeRocket() {
  const g = new THREE.Group();
  g.add(M(new THREE.CylinderGeometry(0.42, 0.48, 2.0, 14), white, 0, 1.25, 0));
  g.add(M(new THREE.ConeGeometry(0.42, 0.9, 14), red, 0, 2.7, 0));
  g.add(M(new THREE.CylinderGeometry(0.3, 0.38, 0.3, 12), dark, 0, 0.12, 0));
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2 + Math.PI / 4;
    const f = M(new THREE.BoxGeometry(0.06, 0.8, 0.5), red, Math.cos(a) * 0.5, 0.55, Math.sin(a) * 0.5);
    f.rotation.y = -a + Math.PI / 2; g.add(f);
  }
  const win = M(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 14), new THREE.MeshBasicMaterial({ color: 0x9fe8ff }), 0, 1.75, 0.43);
  win.rotation.x = Math.PI / 2; g.add(win);
  g.add(M(new THREE.TorusGeometry(0.19, 0.035, 6, 16), mat(0xffcf5a, { metalness: 0.6, roughness: 0.3 }), 0, 1.75, 0.44));
  const fl = flame(0.32, 0xff8a3a);
  g.add(fl);
  fl.scale.set(1, 0.01, 1);
  return { g, flame: fl };
}

/** The launch pad: a round platform with lamps and a gantry, standing at y = 0. */
export function makePad() {
  const g = new THREE.Group();
  g.add(M(new THREE.CylinderGeometry(1.5, 1.7, 0.25, 18), stone, 0, 0.12, 0));
  g.add(M(new THREE.CylinderGeometry(1.0, 1.0, 0.04, 18), dark, 0, 0.26, 0));
  const lamp = new THREE.MeshBasicMaterial({ color: 0xffcf5a });
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; g.add(M(new THREE.SphereGeometry(0.07, 6, 5), lamp, Math.cos(a) * 1.3, 0.28, Math.sin(a) * 1.3)); }
  const tower = new THREE.Group();
  tower.position.set(-1.25, 0, 0);
  tower.add(M(new THREE.BoxGeometry(0.22, 3.2, 0.22), mat(0xff8a3a), 0, 1.6, 0));
  for (let k = 0; k < 4; k++) tower.add(M(new THREE.BoxGeometry(0.6, 0.05, 0.05), dark, 0.3, 0.6 + k * 0.7, 0));
  g.add(tower);
  return { g, lamp };
}

/** A tall light beam standing at y = 0, visible from far around the planet. */
export function makeBeam(color, height = 14, radius = 0.35) {
  return new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.5, radius, height, 10, 1, true).translate(0, height / 2, 0), additive(color, 0.32));
}

/** The comet: a glowing head with a long tail streaming along its -z axis (aim +z where it is going). */
export function makeComet() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 1), mat(0xe8f8ff, { emissive: 0x7ee0ff, emissiveIntensity: 1.6, roughness: 0.2 })));
  const glow = glowSprite(0x9fe8ff, 6);
  g.add(glow, glowSprite(0xffffff, 2.5));
  for (const [r, len, color, opacity] of [[0.9, 14, 0x7ee0ff, 0.28], [0.45, 9, 0xffffff, 0.35]]) {
    const tail = new THREE.Mesh(new THREE.ConeGeometry(r, len, 12, 1, true).rotateX(-Math.PI / 2).translate(0, 0, -len / 2), additive(color, opacity));
    g.add(tail);
  }
  return { g, glow };
}

/** Two jet nozzles under the back of Pip's skateboard; flames (scale.y = thrust) point backwards. */
export const jets = new THREE.Group();
export const jetFlames = [];
{
  const nozzle = new THREE.CylinderGeometry(0.06, 0.08, 0.16, 10).rotateX(Math.PI / 2);
  for (const x of [-0.11, 0.11]) {
    jets.add(M(nozzle, mat(0xc9c4e0, { metalness: 0.6, roughness: 0.3 }), x, -0.02, -0.42));
    const f = flame(0.07, 0x7ee0ff);
    f.rotation.x = -Math.PI / 2; f.position.set(x, -0.02, -0.5);
    f.scale.set(1, 0.01, 1);
    jets.add(f); jetFlames.push(f);
  }
  jets.visible = false;
  board.add(jets);
}

/** Space rocks and stardust motes for jet flights; shared geometry and materials. */
export const rockGeo = new THREE.DodecahedronGeometry(1, 0);
export const rockMat = mat(0x5a4a6a, { emissive: 0x2a1030, emissiveIntensity: 0.5 });
export const moteMat = glowMaterial(0xffd36b);
