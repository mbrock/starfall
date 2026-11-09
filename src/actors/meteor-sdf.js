// Experiment (?sdf=meteors): a lumpy meteor rock with glowing lava cracks, ray-marched inside a small shell.
// One shared material and proxy geometry serve every meteor; each mesh's spin comes in through its model matrix.
import * as THREE from 'three';
import { noiseGLSL, sdfMaterials } from '../engine/sdf.js';

const glsl = `${noiseGLSL}
// Lumps of 8 cm on a 0.56 m ball; the noise is steep, so the distance is scaled down to stay a lower bound.
float sdf(vec3 p) { return (length(p) - 0.56 - 0.08 * noise3(p * 4.5)) * 0.45; }
void sdfSurface(vec3 p, vec3 n, inout vec3 albedo, inout vec3 emissive, inout float rough, inout float metal) {
  float crack = abs(noise3(p * 6.0 + vec3(3.1, -1.7, 0.4)));
  albedo = vec3(0.07, 0.035, 0.05);
  emissive = vec3(1.0, 0.36, 0.08) * (3.0 * (1.0 - smoothstep(0.02, 0.09, crack)) + 0.08);
}`;

const { material, depthMaterial } = sdfMaterials({ glsl, steps: 32, eps: 0.002, cone: 0.0012, far: 2, grazing: 0.01 });
const geo = new THREE.IcosahedronGeometry(0.8, 1);

/** A meteor rock mesh (same contract as the mesh version in meteors.js). */
export function sdfRock() {
  const mesh = new THREE.Mesh(geo, material);
  mesh.customDepthMaterial = depthMaterial;
  return mesh;
}
