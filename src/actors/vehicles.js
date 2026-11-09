// Models for travelling between worlds (game/travel.js): the launch pad, its beacon beam, the jet nozzles on
// Pip's skateboard, and the rocks and stardust motes floating in space. Models only; game/travel.js moves them.
import * as THREE from 'three';
import { glowMaterial, glowSprite, mat } from '../engine/materials.js';
import { board } from './pip.js';

const M = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; return o; };
const additive = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const dark = mat(0x3a3570), stone = mat(0x9a96b8);

/** A cone of flame along -y from the origin; scale.y sets its length. */
function flame(radius, color) {
  const g = new THREE.Group();
  const outer = new THREE.Mesh(new THREE.ConeGeometry(radius, 1, 10, 1, true).rotateX(Math.PI).translate(0, -0.5, 0), additive(color, 0.75));
  const inner = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.5, 0.7, 8, 1, true).rotateX(Math.PI).translate(0, -0.35, 0), additive(0xfff4d0, 0.9));
  g.add(outer, inner, glowSprite(color, radius * 6));
  return g;
}

/** Copies of geometry `part`, one per position in `at`, as one geometry (one draw call instead of one each). */
function repeat(part, at) {
  const out = new THREE.BufferGeometry(), index = [];
  for (const name of Object.keys(part.attributes)) {
    const src = part.attributes[name], arr = new Float32Array(src.array.length * at.length);
    at.forEach((p, k) => {
      arr.set(src.array, k * src.array.length);
      if (name === 'position') for (let i = k * src.array.length; i < (k + 1) * src.array.length; i += 3) { arr[i] += p[0]; arr[i + 1] += p[1]; arr[i + 2] += p[2]; }
    });
    out.setAttribute(name, new THREE.BufferAttribute(arr, src.itemSize));
  }
  at.forEach((_, k) => { for (const i of part.index.array) index.push(i + k * part.attributes.position.count); });
  out.setIndex(index);
  return out;
}

/** The launch pad: a round platform with lamps and a gantry, standing at y = 0. Eight meshes' worth in five draw calls. */
export function makePad() {
  const g = new THREE.Group();
  g.add(M(new THREE.CylinderGeometry(1.5, 1.7, 0.25, 18), stone, 0, 0.12, 0));
  g.add(M(new THREE.CylinderGeometry(1.0, 1.0, 0.04, 18), dark, 0, 0.26, 0));
  const lamp = new THREE.MeshBasicMaterial({ color: 0xffcf5a });
  const lamps = new THREE.Mesh(repeat(new THREE.SphereGeometry(0.07, 6, 5), Array.from({ length: 8 }, (_, i) => [Math.cos(i / 8 * Math.PI * 2) * 1.3, 0.28, Math.sin(i / 8 * Math.PI * 2) * 1.3])), lamp);
  g.add(lamps); // too small to need a shadow
  g.add(M(new THREE.BoxGeometry(0.22, 3.2, 0.22), mat(0xff8a3a), -1.25, 1.6, 0));
  g.add(new THREE.Mesh(repeat(new THREE.BoxGeometry(0.6, 0.05, 0.05), [0, 1, 2, 3].map((k) => [-0.95, 0.6 + k * 0.7, 0])), dark)); // rungs
  return { g, lamp };
}

/** A tall light beam standing at y = 0, visible from far around the planet. */
export function makeBeam(color, height = 14, radius = 0.35) {
  return new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.5, radius, height, 10, 1, true).translate(0, height / 2, 0), additive(color, 0.32));
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
