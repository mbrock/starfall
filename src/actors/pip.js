// Pip's 3D model: body, scarf, antenna, hats, shield bubble, skateboard and feet, posed every frame from
// the pip state in state.js. dressPip() applies the equipped cosmetics.
import * as THREE from 'three';
import { scene } from '../engine/stage.js';
import { glowSprite, mat } from '../engine/materials.js';
import { surfR } from '../sphere.js';
import { active, game, pip } from '../state.js';
import { HATS } from './hats.js';
import { sdf } from '../platform.js';
import { makeSdfPip } from './pip-sdf.js';

export const GIANT_SCALE = 2.6;
const lerp = THREE.MathUtils.lerp;
const ease = (rate, dt) => 1 - Math.exp(-rate * dt);

/** The posed root object; its position is Pip's center in world space. */
export const player = new THREE.Group();
const body = new THREE.Group();
player.add(body);
scene.add(player);

const shellMat = mat(0xf4f0ff, { roughness: 0.5, flatShading: false });
const scarfMat = mat(0xff5a6e, { flatShading: false });
const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a1430 });
const shell = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 18), shellMat);
shell.scale.y = 0.92; shell.castShadow = true; body.add(shell);
const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.07, 8, 24), scarfMat);
scarf.rotation.x = Math.PI / 2; scarf.position.y = -0.12; scarf.castShadow = true; body.add(scarf);
for (const s of [-1, 1]) {
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), eyeMat);
  eye.position.set(0.14 * s, 0.08, 0.37); eye.scale.z = 0.5; body.add(eye);
  eye.visible = !sdf('pip');
}
const antenna = new THREE.Group();
body.add(antenna);
{
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.32, 5), mat(0x8a80b8));
  stalk.position.y = 0.52; stalk.rotation.z = 0.15;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd36b }));
  bulb.position.set(-0.025, 0.69, 0);
  bulb.add(glowSprite(0xffc04a, 0.6));
  antenna.add(stalk, bulb);
  stalk.visible = bulb.material.visible = !sdf('pip'); // keep the bulb's glow sprite
}

const hats = {};
for (const [key, def] of Object.entries(HATS)) {
  const g = new THREE.Group();
  const tint = def.build(g);
  g.visible = false;
  body.add(g);
  hats[key] = { g, tint, baseColor: tint?.color.getHex(), spins: def.spins };
}

const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.8, 24, 16), new THREE.MeshBasicMaterial({ color: 0x6ef0c2, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }));
bubble.position.y = 0.05;
player.add(bubble);

export const board = new THREE.Group();
{
  const smooth = (color, extra) => mat(color, { flatShading: false, ...extra });
  const deck = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.62, 4, 12), smooth(0x9a7bff, { roughness: 0.6 }));
  deck.rotation.x = Math.PI / 2; deck.scale.set(1, 1, 0.16); deck.castShadow = true;
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.01, 0.8), new THREE.MeshBasicMaterial({ color: 0xffcf5a }));
  stripe.position.y = 0.034;
  board.add(deck, stripe);
  const wheelGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.06, 12);
  const wheelMat = smooth(0x6ef0c2, { roughness: 0.4 });
  const truckMat = smooth(0xc9c4e0, { metalness: 0.6, roughness: 0.3 });
  for (const z of [-0.3, 0.3]) {
    const truck = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.05), truckMat);
    truck.position.set(0, -0.05, z); board.add(truck);
    for (const x of [-0.15, 0.15]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2; w.position.set(x, -0.08, z); w.castShadow = true; board.add(w);
    }
  }
  board.position.y = -0.47;
  board.visible = false;
  player.add(board);
}
const feetMat = mat(0xff8a6e, { flatShading: false });
const feet = [-1, 1].map((s) => {
  const f = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), feetMat);
  f.position.set(0.17 * s, -0.36, 0.04); f.scale.set(1, 0.7, 1.3); f.castShadow = true; player.add(f); return f;
});

const sdfPip = sdf('pip') && makeSdfPip({ shellMat, scarfMat, eyeMat, feetMat });
if (sdfPip) {
  for (const m of [shell, scarf, ...feet]) m.visible = false;
  player.add(sdfPip.mesh);
}

let rainbowScarf = false;
/**
 * Apply cosmetics. look: { scarf: {color, rainbow}, body: {color, metalness, roughness, lightEyes},
 * hat: {model, tint}, skateboard: bool }; the item shapes come from game/cosmetics.js.
 */
export function dressPip(look) {
  scarfMat.color.setHex(look.scarf.color);
  rainbowScarf = !!look.scarf.rainbow;
  shellMat.color.setHex(look.body.color);
  shellMat.metalness = look.body.metalness ?? 0;
  shellMat.roughness = look.body.roughness ?? 0.5;
  eyeMat.color.setHex(look.body.lightEyes ? 0xf4f0ff : 0x1a1430);
  const model = look.hat.model;
  for (const k in hats) hats[k].g.visible = k === model;
  const hat = hats[model];
  if (hat.tint) hat.tint.color.setHex(look.hat.tint ?? hat.baseColor);
  antenna.visible = !!HATS[model].showsAntenna;
  board.visible = look.skateboard;
}

const _m = new THREE.Matrix4(), _r = new THREE.Vector3();
export function posePip(dt) {
  const t = game.clock, giant = active('giant'), dashing = active('dash');
  _r.crossVectors(pip.p, pip.f);
  _m.makeBasis(_r, pip.p, pip.f);
  player.quaternion.setFromRotationMatrix(_m);
  pip.scale = lerp(pip.scale, giant ? GIANT_SCALE : 1, ease(giant ? 7 : 4, dt));
  player.scale.setScalar(pip.scale);
  player.position.copy(pip.p).multiplyScalar(surfR(pip.p) + (0.42 + (board.visible ? 0.14 : 0)) * pip.scale);
  if (board.visible) {
    board.rotation.x = lerp(board.rotation.x, dashing ? -0.18 : 0, ease(12, dt));
    board.rotation.z = lerp(board.rotation.z, -pip.turn * 0.18, ease(8, dt));
  }
  pip.walk += dt * (6 + 10 * pip.moving);
  const bob = Math.abs(Math.sin(pip.walk)) * 0.08 * pip.moving;
  body.position.y = bob + Math.sin(t * 2) * 0.02;
  body.rotation.z = lerp(body.rotation.z, -pip.turn * 0.25, ease(8, dt));
  body.rotation.x = lerp(body.rotation.x, dashing ? 0.5 : pip.moving * 0.12, ease(10, dt));
  feet[0].position.z = 0.04 + Math.sin(pip.walk) * 0.14 * pip.moving;
  feet[1].position.z = 0.04 - Math.sin(pip.walk) * 0.14 * pip.moving;
  // blink while invulnerable after a hit
  player.visible = pip.alive && !(pip.inv > 0 && !dashing && !giant && Math.sin(t * 30) > 0.3);
  bubble.visible = pip.shield;
  bubble.scale.setScalar(1 + Math.sin(t * 4) * 0.04);
  for (const k in hats) if (hats[k].spins) hats[k].g.rotation.y += dt * 1.5;
  if (rainbowScarf) scarfMat.color.setHSL((t * 0.3) % 1, 0.85, 0.6);
  if (sdfPip) sdfPip.pose(body, feet, antenna);
}

/** A point `up` m above Pip's center along the planet normal; where popups and bursts about Pip go. */
export const abovePip = (up) => player.position.clone().addScaledVector(pip.p, up);
