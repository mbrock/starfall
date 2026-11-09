// Experiment (?sdf=planet): the planet as a ray-marched signed distance field instead of a mesh. The terrain is
// smooth at every pixel and meteor dents (world/dents.js) are part of the distance function.
import * as THREE from 'three';
import { scene } from '../engine/stage.js';
import { noiseGLSL, sdfMaterials } from '../engine/sdf.js';
import { sdf } from '../platform.js';
import { R } from '../sphere.js';
import { dentGLSL, dentUniforms } from './dents.js';

const uniforms = { palette: { value: Array.from({ length: 5 }, () => new THREE.Color()) }, ...dentUniforms };

/** The planet's ground color at unit direction n, as paintPlanet() picks it per face. */
const paletteGLSL = `${noiseGLSL}
uniform vec3 palette[5];
vec3 groundColor(vec3 n) {
  float h = noise3(n * 2.2), m = noise3(n * 4.0 + vec3(10.0, -3.0, 7.0));
  vec3 c = h < -0.42 ? palette[3] : h < -0.05 ? mix(palette[0], palette[1], (h + 0.42) / 0.37) : mix(palette[1], palette[2], min(1.0, h / 0.6));
  if (m > 0.62) c = mix(c, palette[4], 0.75);
  return c * (1.0 + noise3(n * 13.0) * 0.06);
}`;

const glsl = `${paletteGLSL}
${dentGLSL}
// Radial distance to the heightfield, scaled down because the terrain's slope makes it overestimate.
float sdf(vec3 p) { float r = length(p); vec3 n = p / r; return (r - ${R.toFixed(1)} - noise3(n * 2.2) * 0.24 - dentHeight(n)) * 0.8; }
void sdfSurface(vec3 p, vec3 nrm, inout vec3 albedo, inout vec3 emissive, inout float rough, inout float metal) {
  vec3 n = normalize(p);
  albedo = groundColor(n);
  dentPaint(dentMarks(n), albedo, emissive);
}`;

const { material, depthMaterial } = sdfMaterials({ glsl, uniforms, steps: 40, eps: 0.003, cone: 0.0012, far: 12, grazing: 0.08, params: { roughness: 0.92 } });
// The proxy shell sits above the highest terrain (noise ≤ 0.24 m, dent rim 0.12 m) even across its flat faces.
const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(R + 0.5, 6), material);
shell.customDepthMaterial = depthMaterial;
shell.receiveShadow = true;
if (sdf('planet')) scene.add(shell);

export function paintSdfPlanet(palette) {
  palette.forEach((hex, i) => uniforms.palette.value[i].setHex(hex));
}
