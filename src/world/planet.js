// Pip's planet: a dense, smooth-shaded icosphere displaced by the terrain, colored per pixel from the equipped
// world palette, with meteor craters (world/dents.js) carved into it in the vertex shader. Plus the atmosphere
// halo around its silhouette. Other bodies Pip can travel to (world/bodies.js) are cheaper flat-shaded meshes
// built by planetGeometry() and colored by paintGeometry().
import * as THREE from 'three';
import { scene } from '../engine/stage.js';
import { radialTexture } from '../engine/materials.js';
import { HOME_TERRAIN, R, V, noise3, terrainAt } from '../sphere.js';
import { noiseGLSL } from '../engine/sdf.js';
import { sdf } from '../platform.js';
import { dentGLSL, dentUniforms } from './dents.js';

/** The world palette, [deep, grass, high, sand, bloom]; shared with the SDF planet experiment. */
export const paletteUniform = { value: Array.from({ length: 5 }, () => new THREE.Color()) };

/**
 * groundColor(n, fine) picks the ground color at unit direction n, as sphere.js's noise3 shapes the terrain. The
 * noise that places the sand and bloom edges runs per pixel, so the edges are smooth curves at any distance; fwidth
 * antialiases them to about a pixel. `fine` is a small brightness speckle that can come in per vertex.
 */
export const groundGLSL = `${noiseGLSL}
uniform vec3 palette[5];
vec3 groundColor(vec3 n, float fine) {
  vec3 g = vec3(noise3(n * 2.2), noise3(n * 4.0 + vec3(10.0, -3.0, 7.0)), fine);
  float h = g.x;
  vec3 c = h < -0.05 ? mix(palette[0], palette[1], clamp((h + 0.42) / 0.37, 0.0, 1.0)) : mix(palette[1], palette[2], clamp(h / 0.6, 0.0, 1.0));
  float ah = fwidth(h), am = fwidth(g.y);
  c = mix(c, palette[3], 1.0 - smoothstep(-0.42 - ah, -0.42 + ah, h));
  c = mix(c, palette[4], 0.75 * smoothstep(0.62 - am, 0.62 + am, g.y));
  return c + g.z * 0.025;
}`;

/** The home planet's mesh (null with ?sdf=planet). world/bodies.js moves it into the sky while Pip is away. */
export let homePlanet = null;
if (!sdf('planet')) {
  const geo = new THREE.IcosahedronGeometry(R, 40); // ~34k triangles, about 0.3 m apart: fine enough for the craters
  const pos = geo.attributes.position, fine = new Float32Array(pos.count);
  const v = new V(), n = new V(), a = new V(), b = new V(), c = new V(), t1 = new V(), t2 = new V();
  const at = (out, t, s) => { out.copy(n).addScaledVector(t, s).normalize(); return out.multiplyScalar(R + terrainAt(out, HOME_TERRAIN)); };
  const nor = geo.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    n.fromBufferAttribute(pos, i).normalize();
    v.copy(n).multiplyScalar(R + terrainAt(n, HOME_TERRAIN));
    pos.setXYZ(i, v.x, v.y, v.z);
    fine[i] = noise3(n.x * 13, n.y * 13, n.z * 13);
    // Smooth normal from the terrain's slope around this point.
    t1.crossVectors(n, Math.abs(n.y) < 0.9 ? c.set(0, 1, 0) : c.set(1, 0, 0)).normalize(); t2.crossVectors(n, t1);
    at(a, t1, 0.002).sub(at(c, t1, -0.002));
    at(b, t2, 0.002).sub(at(c, t2, -0.002));
    a.cross(b).normalize(); if (a.dot(n) < 0) a.negate();
    nor.setXYZ(i, a.x, a.y, a.z);
  }
  geo.setAttribute('fine', new THREE.BufferAttribute(fine, 1));
  const material = new THREE.MeshStandardMaterial({ roughness: 0.92 });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, dentUniforms, { palette: paletteUniform });
    shader.vertexShader = `${dentGLSL}\nattribute float fine;\nvarying vec3 vDir;\nvarying float vFine;\nvarying vec2 vDentMarks;\n` + shader.vertexShader
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
      vec3 dn = normalize(position);
      float dh = dentHeight(dn);
      if (dh != 0.0) { // tilt the normal by the crater's slope
        vec3 t1 = normalize(cross(dn, abs(dn.y) < 0.9 ? vec3(0, 1, 0) : vec3(1, 0, 0))), t2 = cross(dn, t1);
        const float e = 0.004; // radians; slope = height change over e * R meters
        vec2 g = vec2(dentHeight(normalize(dn + t1 * e)) - dentHeight(normalize(dn - t1 * e)),
                      dentHeight(normalize(dn + t2 * e)) - dentHeight(normalize(dn - t2 * e))) / (2.0 * e * ${R.toFixed(1)});
        objectNormal = normalize(objectNormal - t1 * g.x - t2 * g.y);
      }
      vDir = dn; vFine = fine;
      // Scorch and glow per vertex, not per pixel: the dent loop per pixel cost ~3 ms of GPU time on the Pi 5.
      vDentMarks = dentMarks(dn);`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n      transformed += dn * dh;');
    shader.fragmentShader = `${dentGLSL}\n${groundGLSL}\nvarying vec3 vDir;\nvarying float vFine;\nvarying vec2 vDentMarks;\n` + shader.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
      diffuseColor.rgb = groundColor(normalize(vDir), vFine);
      dentPaint(vDentMarks, diffuseColor.rgb, totalEmissiveRadiance);`);
  };
  homePlanet = new THREE.Mesh(geo, material);
  homePlanet.receiveShadow = true;
  scene.add(homePlanet);
}

/** Recolor the planet. palette is [deep, grass, high, sand, bloom] hex colors (see WORLDS in game/cosmetics.js). */
export function paintPlanet(palette) {
  palette.forEach((hex, i) => paletteUniform.value[i].setHex(hex));
}

// Atmosphere: a camera-facing sprite sized to the planet's silhouette by updateHalo().
const haloTex = radialTexture(256, [[0, 'rgba(140,120,255,0.0)'], [0.7, 'rgba(140,120,255,0.35)'], [0.75, 'rgba(160,150,255,0.55)'], [0.84, 'rgba(120,100,255,0.18)'], [1, 'rgba(120,100,255,0)']]);
export const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
scene.add(halo);
export function updateHalo(camPos) {
  const dist = camPos.length();
  const rs = R * dist / Math.sqrt(Math.max(dist * dist - R * R, 1));
  halo.scale.setScalar(rs * 2 / 0.72);
}

// ---------- other bodies (only with ?travel=...) ----------

/** A displaced icosphere of `radius` m shaped by `terrain` (see sphere.js), with a color attribute for paintGeometry(). */
export function planetGeometry(radius, terrain, detail = 8) {
  const geo = new THREE.IcosahedronGeometry(radius, detail);
  const pos = geo.attributes.position;
  const v = new V(), n = new V();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i); n.copy(v).normalize();
    v.copy(n).multiplyScalar(radius + terrainAt(n, terrain));
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3));
  geo.computeVertexNormals();
  return geo;
}

/** Shared by every other body so they all use one shader program. */
export const planetMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92 });

/** Color a body's faces from a palette, [deep, grass, high, sand, bloom], the way groundColor() colors the home planet. */
export function paintGeometry(geo, palette, terrain) {
  const [deep, grass, high, sand, bloom] = palette.map((h) => new THREE.Color(h));
  const pos = geo.attributes.position, colors = geo.attributes.color.array;
  const a = new V(), b = new V(), c = new V(), n = new V(), col = new THREE.Color();
  for (let f = 0; f < pos.count; f += 3) {
    a.fromBufferAttribute(pos, f); b.fromBufferAttribute(pos, f + 1); c.fromBufferAttribute(pos, f + 2);
    n.copy(a).add(b).add(c).normalize();
    const h = terrainAt(n, terrain) / terrain.amp;
    const m = noise3(n.x * 4 + 10 + terrain.seed, n.y * 4 - 3, n.z * 4 + 7);
    if (h < -0.42) col.copy(sand);
    else if (h < -0.05) col.copy(deep).lerp(grass, (h + 0.42) / 0.37);
    else col.copy(grass).lerp(high, Math.min(1, h / 0.6));
    if (m > 0.62) col.lerp(bloom, 0.75);
    col.offsetHSL(0, 0, noise3(n.x * 13, n.y * 13, n.z * 13) * 0.025);
    for (let k = 0; k < 3; k++) colors.set([col.r, col.g, col.b], (f + k) * 3);
  }
  geo.attributes.color.needsUpdate = true;
}
