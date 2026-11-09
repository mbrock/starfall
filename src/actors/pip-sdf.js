// Experiment (?sdf=pip): Pip's body, scarf, eyes, antenna and feet as one signed distance field, ray-marched
// inside a box that rides with Pip. Smooth unions blend the scarf and feet into the body like clay, and the
// field's own ambient occlusion darkens the creases. Hats, the skateboard and the shield stay meshes.
import * as THREE from 'three';
import { sdfMaterials } from '../engine/sdf.js';

const glsl = `
uniform mat4 bodyInv;
uniform float footZ[2];
uniform float antennaOn;
uniform vec3 shellCol, scarfCol, eyeCol, feetCol;
uniform float shellRough, shellMetal;
float smin(float a, float b, float k) { float h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * k * 0.25; }
float ellipsoid(vec3 p, vec3 r) { float k0 = length(p / r), k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / k1; }
float capsule(vec3 p, vec3 a, vec3 b, float r) { vec3 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)) - r; }
// Each part's distance; p is in Pip's space, q in the body's (it bobs, leans and tilts).
float dShell(vec3 q) { return ellipsoid(q, vec3(0.42, 0.386, 0.42)); }
float dScarf(vec3 q) { q.y += 0.12; return length(vec2(length(q.xz) - 0.37, q.y)) - 0.07; }
float dEyes(vec3 q) { q.x = abs(q.x); return ellipsoid(q - vec3(0.14, 0.08, 0.37), vec3(0.055, 0.055, 0.0275)); }
float dAntenna(vec3 q) {
  if (antennaOn < 0.5) return 1.0;
  return min(capsule(q, vec3(0.024, 0.362, 0.0), vec3(-0.024, 0.678, 0.0), 0.018), length(q - vec3(-0.025, 0.69, 0.0)) - 0.07);
}
float dFeet(vec3 p) {
  float a = ellipsoid(p - vec3(-0.17, -0.36, footZ[0]), vec3(0.11, 0.077, 0.143));
  float b = ellipsoid(p - vec3(0.17, -0.36, footZ[1]), vec3(0.11, 0.077, 0.143));
  return min(a, b);
}
float sdf(vec3 p) {
  vec3 q = (bodyInv * vec4(p, 1.0)).xyz;
  float d = smin(dShell(q), dScarf(q), 0.06);
  d = min(d, dEyes(q));
  d = smin(d, dAntenna(q), 0.03);
  return smin(d, dFeet(p), 0.07);
}
void sdfSurface(vec3 p, vec3 n, inout vec3 albedo, inout vec3 emissive, inout float rough, inout float metal) {
  vec3 q = (bodyInv * vec4(p, 1.0)).xyz;
  float s = dShell(q), sc = dScarf(q), e = dEyes(q), f = dFeet(p);
  albedo = shellCol; rough = shellRough; metal = shellMetal;
  // Blend part colors across the smooth joins.
  albedo = mix(albedo, scarfCol, smoothstep(0.02, -0.02, sc - s)); 
  float fw = smoothstep(0.03, -0.03, f - min(s, sc));
  albedo = mix(albedo, feetCol, fw); rough = mix(rough, 0.85, max(fw, step(sc, s))); metal *= 1.0 - fw;
  if (e < 0.004) { albedo = eyeCol; rough = 0.25; metal = 0.0; }
  if (antennaOn > 0.5 && length(q - vec3(-0.025, 0.69, 0.0)) < 0.075) { albedo = vec3(0.0); emissive = vec3(1.0, 0.75, 0.3); }
  else if (antennaOn > 0.5 && dAntenna(q) < 0.004) albedo = vec3(0.27, 0.22, 0.48);
}`;

/** Build SDF Pip from Pip's own materials, whose colors it shares, so cosmetics apply as they do to the meshes. */
export function makeSdfPip({ shellMat, scarfMat, eyeMat, feetMat }) {
  const uniforms = {
    bodyInv: { value: new THREE.Matrix4() }, footZ: { value: [0, 0] }, antennaOn: { value: 1 },
    shellCol: { value: shellMat.color }, scarfCol: { value: scarfMat.color }, eyeCol: { value: eyeMat.color }, feetCol: { value: feetMat.color },
    shellRough: { value: 0.5 }, shellMetal: { value: 0 },
  };
  const box = [-0.55, -0.55, -0.63, 0.55, 1.05, 0.67];
  const { material, depthMaterial } = sdfMaterials({ glsl, uniforms, steps: 32, eps: 0.001, cone: 0.0012, far: 3, box, ao: true });
  const geo = new THREE.BoxGeometry(1.1, 1.6, 1.3);
  geo.translate(0, 0.25, 0.02);
  const mesh = new THREE.Mesh(geo, material);
  mesh.customDepthMaterial = depthMaterial;
  mesh.castShadow = true;

  /** Copy this frame's pose: the body group, the two feet, and whether the antenna shows. */
  function pose(body, feet, antenna) {
    body.updateMatrix();
    uniforms.bodyInv.value.copy(body.matrix).invert();
    uniforms.footZ.value[0] = feet[0].position.z; uniforms.footZ.value[1] = feet[1].position.z;
    uniforms.antennaOn.value = antenna.visible ? 1 : 0;
    uniforms.shellRough.value = shellMat.roughness; uniforms.shellMetal.value = shellMat.metalness;
  }
  return { mesh, pose };
}
