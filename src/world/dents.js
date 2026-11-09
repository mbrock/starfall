// Experiment (?sdf=planet or ?planet=dense): meteors carve dents (a bowl with a raised rim) into the planet.
// The dents list in sphere.js makes gameplay heights follow them; these uniforms and GLSL let either planet
// draw them: the SDF planet in its distance function, the dense mesh by moving its vertices.
import * as THREE from 'three';
import { R, dents } from '../sphere.js';

const MAX_DENTS = 12, DENT_LIFE = 24, HEAL = 6;

export const dentUniforms = {
  dentAt: { value: Array.from({ length: MAX_DENTS }, () => new THREE.Vector4(0, 1, 0, 0)) },
  dentHeat: { value: new Array(MAX_DENTS).fill(0) },
  dentCount: { value: 0 },
};

/** dentH matches sphere.js; dentHeight sums the dents at unit direction n; dentMarks and dentPaint scorch and heat them. */
export const dentGLSL = `
uniform vec4 dentAt[${MAX_DENTS}];
uniform float dentHeat[${MAX_DENTS}];
uniform int dentCount;
float dentH(float c) {
  float x = min(c / 1.3, 1.0), b = 1.0 - x * x, r = (c - 1.25) / 0.3;
  return -0.4 * b * b + 0.12 * exp(-r * r);
}
float dentHeight(vec3 n) {
  float h = 0.0;
  for (int i = 0; i < ${MAX_DENTS}; i++) {
    if (i >= dentCount) break;
    if (dot(n, dentAt[i].xyz) < ${Math.cos(2.2 / R).toFixed(4)}) continue; // more than 2.2 m away: the rim has faded out
    h += dentAt[i].w * dentH(length(n - dentAt[i].xyz) * ${R.toFixed(1)});
  }
  return h;
}
// (scorch, glow) at n: how much a dent darkens the ground and how hot it still glows.
vec2 dentMarks(vec3 n) {
  vec2 m = vec2(0.0);
  for (int i = 0; i < ${MAX_DENTS}; i++) {
    if (i >= dentCount) break;
    if (dot(n, dentAt[i].xyz) < ${Math.cos(1.4 / R).toFixed(4)}) continue;
    float d = length(n - dentAt[i].xyz) * ${R.toFixed(1)};
    m += vec2((1.0 - smoothstep(0.6, 1.4, d)) * dentAt[i].w * 0.75, dentHeat[i] * (1.0 - smoothstep(0.0, 0.8, d)));
  }
  return m;
}
void dentPaint(vec2 m, inout vec3 albedo, inout vec3 emissive) {
  albedo = mix(albedo, vec3(0.05, 0.03, 0.08), min(m.x, 1.0));
  emissive += vec3(1.0, 0.35, 0.08) * 2.5 * m.y;
}`;

/** Carve a dent where a meteor lands. */
export function dentPlanet(n) {
  if (dents.length >= MAX_DENTS) dents.shift();
  dents.push({ n: n.clone(), k: 0, age: 0 });
}

/** Deepen new dents over 1/8 s, then let them heal back out. */
export function updateDents(dt) {
  for (let i = dents.length - 1; i >= 0; i--) {
    const d = dents[i];
    d.age += dt;
    d.k = Math.min(1, d.age * 8, (DENT_LIFE - d.age) / HEAL);
    if (d.k <= 0) dents.splice(i, 1);
  }
  const u = dentUniforms;
  for (let i = 0; i < MAX_DENTS; i++) {
    const d = dents[i];
    if (d) u.dentAt.value[i].set(d.n.x, d.n.y, d.n.z, d.k);
    u.dentHeat.value[i] = d ? Math.max(0, 1 - d.age / 2.5) : 0;
  }
  u.dentCount.value = dents.length;
}
