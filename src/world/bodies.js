// The worlds Pip can travel to (game/travel.js). Each body is one mesh: the one Pip
// stands on sits at the origin and the others hang in the sky at their offset from it, so flying in and landing
// never swaps a model. Home is the smooth cratered planet (world/planet.js); the others are cheaper flat-shaded
// meshes, and meteors only carve craters at home (the crater shader assumes the home planet's radius).
// `at` places each body in one shared map of the system; only differences between two `at`s matter.
import * as THREE from 'three';
import { scene } from '../engine/stage.js';
import { HOME_TERRAIN, V, setGround } from '../sphere.js';
import { halo, homePlanet, paintGeometry, planetGeometry, planetMat } from './planet.js';
import { enableDents } from './dents.js';
import { respreadDecor } from './decor.js';
import { setLandmarksHome } from './landmarks.js';

export const BODIES = [
  { id: 'home', name: "Pip's World", blurb: 'Home', radius: 10, terrain: HOME_TERRAIN, at: [0, 0, 0], mul: 1, meteors: 1, halo: 0xffffff },
  {
    id: 'moon', name: 'Lumen Moon', blurb: 'Small and quick', radius: 6, terrain: { amp: 0.34, freq: 3.2, seed: 4.1 },
    palette: [0x6a6880, 0xa8a5b8, 0xd8d5e8, 0x4a4860, 0xffe08a], decor: { rock: 0.55, crystal: 0.6 },
    at: [-55, 35, -70], mul: 1.5, meteors: 0.8, halo: 0xd8e0ff,
  },
  {
    id: 'ember', name: 'Ember Rock', blurb: 'A tiny hot asteroid', radius: 4.5, terrain: { amp: 0.5, freq: 2.6, seed: 9.3 },
    palette: [0x2a1a1f, 0x4a2a2a, 0x6e3b30, 0xff7a2a, 0xffcf5a], decor: { rock: 0.45, crystal: 0.35 },
    at: [70, -15, -60], mul: 2, meteors: 0.65, halo: 0xff9a6a,
  },
  {
    id: 'bloom', name: 'Bloom', blurb: 'A big candy planet', radius: 13, terrain: { amp: 0.42, freq: 1.8, seed: 2.7 },
    palette: [0xd96aa8, 0xff9ad5, 0xffd1ec, 0xfff1a8, 0x7ee0ff], decor: { tree: 1, round: 1, crystal: 1, rock: 0.3 },
    at: [30, 55, 85], mul: 2.5, meteors: 1.15, halo: 0xffb0e0,
  },
];
export const HOME = BODIES[0];
export const bodyById = (id) => BODIES.find((b) => b.id === id);

/** The body Pip stands on (at the origin). */
export const here = { body: HOME };

let built = false;
/** Make the worlds' models; game/travel.js calls it once at load. */
export function buildBodies() {
  if (built) return;
  built = true;
  for (const b of BODIES) {
    b.at = new V(...b.at);
    if (b === HOME) b.mesh = homePlanet;
    else {
      const geo = planetGeometry(b.radius, b.terrain, b.radius < 7 ? 6 : 8);
      paintGeometry(geo, b.palette, b.terrain);
      b.mesh = new THREE.Mesh(geo, planetMat);
      b.mesh.receiveShadow = true;
      scene.add(b.mesh);
    }
    b.glow = new THREE.Sprite(halo.material.clone());
    b.glow.material.color.setHex(b.halo);
    scene.add(b.glow);
  }
  placeSky();
}

/** Where body b's center is now, relative to the body at the origin. */
export const offsetOf = (b, out = new V()) => out.subVectors(b.at, here.body.at);

function placeSky() {
  for (const b of BODIES) {
    b.glow.visible = b !== here.body; // the body underfoot uses the planet's own halo
    offsetOf(b, b.glow.position);
    b.mesh?.position.copy(b.glow.position);
  }
}

/** Put body b at the origin under Pip. Everything standing on the ground must be repositioned by the caller. */
export function setBody(b) {
  here.body = b;
  setGround(b.radius, b.terrain);
  enableDents(b === HOME);
  halo.material.color.setHex(b.halo);
  respreadDecor(b === HOME ? null : b.decor);
  setLandmarksHome(b === HOME);
  placeSky();
}

const _d = new V();
/** Size the halos of the bodies in the sky to their silhouettes, like updateHalo() does for the planet. */
export function updateSkyHalos(camPos) {
  for (const b of BODIES) {
    if (!b.glow.visible) continue;
    const dist = _d.subVectors(b.glow.position, camPos).length(), r = b.radius;
    b.glow.scale.setScalar(r * dist / Math.sqrt(Math.max(dist * dist - r * r, 1)) * 2 / 0.72);
  }
}
