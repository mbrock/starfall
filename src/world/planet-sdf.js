// Experiment (?sdf=planet): the planet as a ray-marched signed distance field instead of a mesh. The terrain is
// smooth at every pixel and meteor dents (world/dents.js) are part of the distance function.
import * as THREE from 'three';
import { scene } from '../engine/stage.js';
import { sdfMaterials } from '../engine/sdf.js';
import { sdf } from '../platform.js';
import { R } from '../sphere.js';
import { dentGLSL, dentUniforms } from './dents.js';
import { groundGLSL, paletteUniform } from './planet.js';

const uniforms = { palette: paletteUniform, ...dentUniforms };

const glsl = `${groundGLSL}
${dentGLSL}
// Radial distance to the heightfield, scaled down because the terrain's slope makes it overestimate.
float sdf(vec3 p) { float r = length(p); vec3 n = p / r; return (r - ${R.toFixed(1)} - noise3(n * 2.2) * 0.24 - dentHeight(n)) * 0.8; }
void sdfSurface(vec3 p, vec3 nrm, inout vec3 albedo, inout vec3 emissive, inout float rough, inout float metal) {
  vec3 n = normalize(p);
  albedo = groundColor(n, noise3(n * 13.0));
  dentPaint(dentMarks(n), albedo, emissive);
}`;

const { material, depthMaterial } = sdfMaterials({ glsl, uniforms, steps: 40, eps: 0.003, cone: 0.0012, far: 12, grazing: 0.08, params: { roughness: 0.92 } });
// The proxy shell sits above the highest terrain (noise ≤ 0.24 m, dent rim 0.12 m) even across its flat faces.
const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(R + 0.5, 6), material);
shell.customDepthMaterial = depthMaterial;
shell.receiveShadow = true;
if (sdf('planet')) scene.add(shell);
