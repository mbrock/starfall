// Star Buddies (shop: Helpers): little stars that circle Pip's head and fly off to grab nearby pickups.
import * as THREE from 'three';
import { scene } from '../engine/stage.js';
import { glowSprite } from '../engine/materials.js';
import { emit } from '../engine/particles.js';
import { sfx } from '../engine/audio.js';
import { R, V, chord, rand, randomUnit } from '../sphere.js';
import { game, pip, stats } from '../state.js';
import { pickups } from './pickups.js';
import { player } from './pip.js';

// [core color, glow color]; one per possible buddy, so this also caps how many the shop sells.
const LOOKS = [[0xbffff0, 0x6ef0c2], [0xfff1b8, 0xffc24a], [0xf0d8ff, 0xb08aff], [0xffd0d8, 0xff5a6e], [0xd0ecff, 0x5ab8ff], [0xe8ffd0, 0x9be05a], [0xffe0c8, 0xff8a3a], [0xffffff, 0xd8dde8]];
const buddies = LOOKS.map(([core, glow], k) => {
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), new THREE.MeshBasicMaterial({ color: core }));
  g.add(mesh, glowSprite(glow, 1.1));
  g.visible = false;
  scene.add(g);
  return { g, mesh, color: new THREE.Color(glow), target: null, rest: 0, phase: k * Math.PI * 2 / LOOKS.length, ring: k < 4 ? 0.9 : 1.4 };
});

export function resetBuddies() {
  for (const b of buddies) { b.target = null; b.rest = 0; b.g.position.copy(pip.p).multiplyScalar(R + 2); }
}
export function hideBuddies() { for (const b of buddies) b.g.visible = false; }

const _r = new V(), _b = new V(), _v = new V();
/** collect(pickup) runs when a buddy reaches its target. */
export function updateBuddies(dt, collect) {
  const n = game.phase === 'play' && pip.alive ? stats.buddies : 0;
  buddies.forEach((b, k) => { b.g.visible = k < n; });
  _r.crossVectors(pip.p, pip.f);
  for (let k = 0; k < n; k++) {
    const b = buddies[k], bg = b.g;
    b.mesh.rotation.y += dt * 4;
    b.rest -= dt;
    if (b.target && !pickups.includes(b.target)) b.target = null;
    if (!b.target && b.rest <= 0) {
      let bestD = stats.buddyRange;
      const medic = stats.medicBuddies && pip.lives < stats.maxLives;
      for (const pk of pickups) {
        if ((pk.kind === 'heart' && !medic) || pk.age < 0.4 || buddies.some((o) => o.target === pk)) continue;
        const d = chord(pip.p, pk.n); if (d < bestD) { bestD = d; b.target = pk; }
      }
    }
    if (b.target) {
      _b.copy(b.target.g.position).addScaledVector(b.target.n, 0.4);
      _v.subVectors(_b, bg.position);
      const d = _v.length();
      if (d < 0.45) { collect(b.target); b.target = null; b.rest = stats.buddyRest; sfx.buddyGrab(k); continue; }
      bg.position.addScaledVector(_v, Math.min(1, stats.buddySpeed * dt / d));
      if (Math.random() < 0.6) emit(bg.position, randomUnit(_v).multiplyScalar(0.3), b.color, rand(0.3, 0.5), 0);
    } else {
      // circle around Pip's head
      const a = game.clock * 2 + b.phase, s = pip.scale;
      _b.copy(player.position).addScaledVector(pip.p, 1.1 * s).addScaledVector(_r, Math.cos(a) * b.ring * s).addScaledVector(pip.f, Math.sin(a) * b.ring * s);
      bg.position.lerp(_b, 1 - Math.exp(-6 * dt));
    }
  }
}
