// Experimental (?sdf=...): signed-distance-field shapes drawn by ray marching inside a proxy mesh.
// The proxy (a box or shell around the shape) only decides which pixels run the march; each pixel then
// sphere-traces `float sdf(vec3 p)` in the mesh's local space, writes the hit's depth, and hands the hit's
// position and normal to three's MeshStandardMaterial lighting, so SDF shapes are lit, cast and receive
// shadows, and depth-sort against ordinary meshes like any other object.
//
// The GLSL passed in defines, in the mesh's local space (uniform scale only):
//   float sdf(vec3 p)                    distance to the surface (a lower bound is fine)
//   void sdfSurface(vec3 p, vec3 n, inout vec3 albedo, inout vec3 emissive, inout float rough, inout float metal)
// Options: steps (march iterations), eps (hit threshold), cone (extra threshold per unit of t), far (give-up
// distance), grazing (how far from the surface a ray that ran out of steps may stop and still count), box
// ([minX, minY, minZ, maxX, maxY, maxZ], a box proxy's bounds, so missing rays stop where they leave it),
// ao (5-tap SDF ambient occlusion on indirect light).
import * as THREE from 'three';

const vertexHead = `varying vec3 vSdfRo; varying vec3 vSdfRd;\n`;
// The ray in local space: from the proxy vertex away from the camera (or along the view axis for the
// orthographic shadow camera). Both are affine in the vertex position, so interpolation is exact.
const vertexBody = `
  vSdfRo = transformed;
  mat4 sdfInv = inverse(modelMatrix);
  vSdfRd = isOrthographic
    ? mat3(sdfInv) * -vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2])
    : transformed - (sdfInv * vec4(cameraPosition, 1.0)).xyz;
`;

function patchVertex(shader) {
  shader.vertexShader = vertexHead + shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>\n${vertexBody}`);
}

function traceGLSL(glsl, steps, eps, cone, far, grazing, box) {
  const v3 = (a) => `vec3(${a.map((x) => x.toFixed(3)).join(', ')})`;
  // With a box (the proxy's bounds), a ray gives up where it leaves the box instead of marching on to far.
  const exit = box ? `vec3 tb1 = (${v3(box.slice(0, 3))} - ro) / rd, tb2 = (${v3(box.slice(3))} - ro) / rd, tb = max(tb1, tb2);
  float tFar = min(${far.toFixed(2)}, min(tb.x, min(tb.y, tb.z)));` : `float tFar = ${far.toFixed(2)};`;
  return `
varying vec3 vSdfRo; varying vec3 vSdfRd;
uniform mat4 modelMatrix; uniform mat4 projectionMatrix;
${glsl}
vec3 sdfP; vec3 sdfN; float sdfDepth;
bool sdfTrace() {
  vec3 ro = vSdfRo, rd = normalize(vSdfRd);
  ${exit}
  float t = 0.0, d = 1.0;
  for (int i = 0; i < ${steps}; i++) {
    d = sdf(ro + rd * t);
    // Claybook's stop rule: a hit once the distance is under the pixel's cone width at t (cone = radians per pixel).
    if (d < ${eps.toFixed(5)} + ${cone.toFixed(5)} * t) break;
    t += d;
    if (t > tFar) return false;
  }
  // Out of steps: grazing rays crawl along a surface, so count them as hits when they are close enough.
  if (d > ${eps.toFixed(5)} + ${cone.toFixed(5)} * t + ${grazing.toFixed(5)}) return false;
  sdfP = ro + rd * t;
  const vec2 k = vec2(1.0, -1.0); const float h = ${(eps * 2).toFixed(5)};
  sdfN = normalize(k.xyy * sdf(sdfP + k.xyy * h) + k.yyx * sdf(sdfP + k.yyx * h) + k.yxy * sdf(sdfP + k.yxy * h) + k.xxx * sdf(sdfP + k.xxx * h));
  vec4 clip = projectionMatrix * viewMatrix * modelMatrix * vec4(sdfP, 1.0);
  sdfDepth = clip.z / clip.w * 0.5 + 0.5;
  return true;
}
`;
}

/**
 * Make the material and shadow-depth material for an SDF mesh. Give the proxy mesh both:
 * mesh.material = material; mesh.customDepthMaterial = depthMaterial.
 */
export function sdfMaterials({ glsl, uniforms = {}, steps = 48, eps = 0.002, cone = 0.001, far = 100, grazing = 0, box = null, ao = false, params = {} }) {
  const trace = traceGLSL(glsl, steps, eps, cone, far, grazing, box);
  const key = () => trace + ao;
  const material = new THREE.MeshStandardMaterial({ roughness: 0.85, ...params });
  material.customProgramCacheKey = key; // three otherwise shares one program between all onBeforeCompile closures
  material.shadowSide = THREE.FrontSide; // march from the faces nearest the light, as for the camera
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    patchVertex(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', `${trace}
vec3 sdfViewPos;
#define vViewPosition sdfViewPos
#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
  uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
  vec4 sdfShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
  #define vDirectionalShadowCoord sdfShadowCoord
#endif
float sdfAO(vec3 p, vec3 n) {
  float occ = 0.0, w = 1.0;
  for (int i = 1; i <= 5; i++) { float h = 0.03 * float(i); occ += (h - sdf(p + n * h)) * w; w *= 0.7; }
  return clamp(1.0 - 4.0 * occ, 0.0, 1.0);
}
void main() {
  if (!sdfTrace()) discard;
  gl_FragDepth = sdfDepth;
  vec4 sdfWorld = modelMatrix * vec4(sdfP, 1.0);
  vec3 sdfWorldN = normalize(mat3(modelMatrix) * sdfN);
  sdfViewPos = -(viewMatrix * sdfWorld).xyz;
  #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
    #pragma unroll_loop_start
    for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
      sdfShadowCoord[ i ] = directionalShadowMatrix[ i ] * (sdfWorld + vec4(sdfWorldN * directionalLightShadows[ i ].shadowNormalBias, 0.0));
    }
    #pragma unroll_loop_end
  #endif`)
      .replace('#include <normal_fragment_begin>', `float faceDirection = 1.0;
  vec3 normal = normalize(mat3(viewMatrix) * sdfWorldN);
  vec3 nonPerturbedNormal = normal;`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
  sdfSurface(sdfP, sdfN, diffuseColor.rgb, totalEmissiveRadiance, roughnessFactor, metalnessFactor);`)
      .replace('#include <aomap_fragment>', ao ? `float sdfOcc = sdfAO(sdfP, sdfN);
  reflectedLight.indirectDiffuse *= sdfOcc; reflectedLight.indirectSpecular *= sdfOcc; reflectedLight.directDiffuse *= mix(0.6, 1.0, sdfOcc);` : '');
  };

  const depthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  depthMaterial.customProgramCacheKey = key;
  depthMaterial.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    patchVertex(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', `${trace}\nvoid main() {\n  if (!sdfTrace()) discard;\n  gl_FragDepth = sdfDepth;`)
      .replace('float fragCoordZ = 0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5;', 'float fragCoordZ = sdfDepth;');
  };
  return { material, depthMaterial };
}

/** The noise3 of sphere.js in GLSL, so SDF terrain matches the heights gameplay uses. */
export const noiseGLSL = `
float noise3(vec3 q) {
  return sin(q.x * 1.7 + sin(q.z * 1.3)) * cos(q.y * 1.9 + sin(q.x * 1.1)) * 0.6
    + sin(q.y * 3.3 + q.z * 2.7 + q.x * 0.7) * 0.25
    + sin(q.x * 5.1 - q.y * 4.3 + q.z * 3.9) * 0.12;
}`;
