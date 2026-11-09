// Pip's planet: a displaced icosphere whose face colors come from the equipped world palette,
// plus the atmosphere halo around its silhouette.
import * as THREE from 'three';
import { scene } from '../engine/stage.js';
import { radialTexture } from '../engine/materials.js';
import { R, V, noise3, surfR } from '../sphere.js';
import { densePlanet, sdf } from '../platform.js';
import { paintSdfPlanet } from './planet-sdf.js';
import { dentGLSL, dentUniforms } from './dents.js';

const planetGeo = new THREE.IcosahedronGeometry(R, densePlanet ? 40 : 8);
if (!sdf('planet')) {
  const pos = planetGeo.attributes.position;
  const v = new V(), n = new V();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i); n.copy(v).normalize();
    v.copy(n).multiplyScalar(surfR(n));
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  planetGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3));
  planetGeo.computeVertexNormals();
  if (densePlanet) { // smooth normals from the heightfield, for the ?planet=dense comparison
    const nor = planetGeo.attributes.normal, t1 = new V(), t2 = new V(), a = new V(), b = new V(), c = new V();
    const ground = (out, t, s) => { out.copy(n).addScaledVector(t, s).normalize(); return out.multiplyScalar(surfR(out)); };
    for (let i = 0; i < pos.count; i++) {
      n.fromBufferAttribute(pos, i).normalize();
      t1.crossVectors(n, Math.abs(n.y) < 0.9 ? new V(0, 1, 0) : new V(1, 0, 0)).normalize(); t2.crossVectors(n, t1);
      ground(a, t1, 0.002).sub(ground(c, t1, -0.002));
      ground(b, t2, 0.002).sub(ground(c, t2, -0.002));
      a.cross(b).normalize(); if (a.dot(n) < 0) a.negate();
      nor.setXYZ(i, a.x, a.y, a.z);
    }
  }
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: !densePlanet, roughness: 0.92 });
  if (densePlanet) material.onBeforeCompile = carveDents;
  const planet = new THREE.Mesh(planetGeo, material);
  planet.receiveShadow = true;
  scene.add(planet);
}

// The dense planet carves meteor dents (world/dents.js) by moving its vertices and tilting their normals.
function carveDents(shader) {
  Object.assign(shader.uniforms, dentUniforms);
  shader.vertexShader = `${dentGLSL}\nvarying vec2 vDentMarks;\n` + shader.vertexShader
    .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
    vec3 dn = normalize(position);
    float dh = dentHeight(dn);
    if (dh != 0.0) {
      vec3 t1 = normalize(cross(dn, abs(dn.y) < 0.9 ? vec3(0, 1, 0) : vec3(1, 0, 0))), t2 = cross(dn, t1);
      const float e = 0.004; // radians; slope = height change over e * R meters
      vec2 g = vec2(dentHeight(normalize(dn + t1 * e)) - dentHeight(normalize(dn - t1 * e)),
                    dentHeight(normalize(dn + t2 * e)) - dentHeight(normalize(dn - t2 * e))) / (2.0 * e * ${R.toFixed(1)});
      objectNormal = normalize(objectNormal - t1 * g.x - t2 * g.y);
    }
    vDentMarks = dentMarks(dn); // per vertex: the dense mesh is fine enough, and it keeps the dent loop out of every pixel`)
    .replace('#include <begin_vertex>', '#include <begin_vertex>\n    transformed += dn * dh;');
  shader.fragmentShader = `${dentGLSL}\nvarying vec2 vDentMarks;\n` + shader.fragmentShader
    .replace('#include <color_fragment>', '#include <color_fragment>\n  dentPaint(vDentMarks, diffuseColor.rgb, totalEmissiveRadiance);');
}

let painted = null;
/** Recolor the planet. palette is [deep, grass, high, sand, bloom] hex colors (see WORLDS in game/cosmetics.js). */
export function paintPlanet(palette) {
  if (painted === palette) return;
  painted = palette;
  paintSdfPlanet(palette);
  if (sdf('planet')) return;
  const [deep, grass, high, sand, bloom] = palette.map((h) => new THREE.Color(h));
  const pos = planetGeo.attributes.position, colors = planetGeo.attributes.color.array;
  const a = new V(), b = new V(), c = new V(), n = new V(), col = new THREE.Color();
  for (let f = 0; f < pos.count; f += 3) {
    a.fromBufferAttribute(pos, f); b.fromBufferAttribute(pos, f + 1); c.fromBufferAttribute(pos, f + 2);
    n.copy(a).add(b).add(c).normalize();
    const h = noise3(n.x * 2.2, n.y * 2.2, n.z * 2.2);
    const m = noise3(n.x * 4 + 10, n.y * 4 - 3, n.z * 4 + 7);
    if (h < -0.42) col.copy(sand);
    else if (h < -0.05) col.copy(deep).lerp(grass, (h + 0.42) / 0.37);
    else col.copy(grass).lerp(high, Math.min(1, h / 0.6));
    if (m > 0.62) col.lerp(bloom, 0.75);
    col.offsetHSL(0, 0, noise3(n.x * 13, n.y * 13, n.z * 13) * 0.025);
    for (let k = 0; k < 3; k++) colors.set([col.r, col.g, col.b], (f + k) * 3);
  }
  planetGeo.attributes.color.needsUpdate = true;
}

// Atmosphere: a camera-facing sprite sized to the planet's silhouette by updateHalo().
const haloTex = radialTexture(256, [[0, 'rgba(140,120,255,0.0)'], [0.7, 'rgba(140,120,255,0.35)'], [0.75, 'rgba(160,150,255,0.55)'], [0.84, 'rgba(120,100,255,0.18)'], [1, 'rgba(120,100,255,0)']]);
const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
scene.add(halo);
export function updateHalo(camPos) {
  const dist = camPos.length();
  const rs = R * dist / Math.sqrt(Math.max(dist * dist - R * R, 1));
  halo.scale.setScalar(rs * 2 / 0.72);
}
