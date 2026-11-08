// Shader-drawn disks that hug the terrain: meteor warning rings, craters and shockwaves.
import * as THREE from 'three';
import { scene } from '../engine/stage.js';
import { R, UP, V, surfR } from '../sphere.js';

/** A disk of `radius` m centered on surface point `center`, draped over the terrain. Its rr attribute is 0 at the center and 1 at the rim. */
function diskGeometry(center, radius, rings, segs, lift) {
  const t1 = new V().crossVectors(Math.abs(center.y) < 0.9 ? UP : new V(1, 0, 0), center).normalize();
  const t2 = new V().crossVectors(center, t1);
  const pos = [], rr = [], idx = [];
  const d = new V();
  for (let k = 0; k <= rings; k++) {
    const r = radius * k / rings;
    for (let s = 0; s < segs; s++) {
      const a = s / segs * Math.PI * 2;
      d.copy(center).multiplyScalar(R).addScaledVector(t1, Math.cos(a) * r).addScaledVector(t2, Math.sin(a) * r).normalize();
      d.multiplyScalar(surfR(d) + lift);
      pos.push(d.x, d.y, d.z); rr.push(k / rings);
    }
  }
  for (let k = 0; k < rings; k++) for (let s = 0; s < segs; s++) {
    const a = k * segs + s, b = k * segs + (s + 1) % segs, c = (k + 1) * segs + s, e = (k + 1) * segs + (s + 1) % segs;
    idx.push(a, c, b, b, c, e);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('rr', new THREE.Float32BufferAttribute(rr, 1));
  g.setIndex(idx);
  return g;
}

const vertexShader = `attribute float rr; varying float vR; void main(){ vR = rr; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const common = { vertexShader, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 };

const KINDS = {
  // Fills from the center as the meteor falls; the fill reaching the rim is the moment of impact.
  warn: {
    rings: 8, segs: 44, lift: 0.1, renderOrder: 2,
    material: new THREE.ShaderMaterial({
      ...common,
      uniforms: { prog: { value: 0 }, time: { value: 0 }, col: { value: new THREE.Color(1.0, 0.33, 0.42) } },
      fragmentShader: `uniform float prog; uniform float time; uniform vec3 col; varying float vR;
        void main(){
          float edge = smoothstep(0.85, 0.9, vR) * (1.0 - smoothstep(0.97, 1.0, vR));
          float pulse = 0.6 + 0.4 * sin(time * (10.0 + prog * 20.0));
          float fill = step(vR, prog) * (0.12 + 0.28 * prog);
          float front = smoothstep(prog - 0.07, prog, vR) * (1.0 - step(prog, vR));
          float a = max(max(edge * pulse, fill), front * 0.85);
          if (a < 0.01) discard;
          gl_FragColor = vec4(col, a);
        }`,
    }),
  },
  crater: {
    rings: 6, segs: 32, lift: 0.08, renderOrder: 1,
    material: new THREE.ShaderMaterial({
      ...common,
      uniforms: { fade: { value: 1 }, heat: { value: 1 } },
      fragmentShader: `uniform float fade; uniform float heat; varying float vR;
        void main(){
          float a = (1.0 - smoothstep(0.5, 1.0, vR)) * 0.62 * fade;
          float e = (1.0 - smoothstep(0.0, 0.5, vR)) * heat;
          vec3 c = mix(vec3(0.09, 0.05, 0.16), vec3(1.0, 0.5, 0.18), e);
          a = max(a, e);
          if (a < 0.01) discard;
          gl_FragColor = vec4(c, a);
        }`,
    }),
  },
  shock: {
    rings: 10, segs: 48, lift: 0.14, renderOrder: 3,
    material: new THREE.ShaderMaterial({
      ...common, blending: THREE.AdditiveBlending,
      uniforms: { prog: { value: 0 } },
      fragmentShader: `uniform float prog; varying float vR;
        void main(){
          float a = smoothstep(prog - 0.18, prog, vR) * (1.0 - smoothstep(prog, prog + 0.03, vR)) * (1.0 - prog);
          if (a < 0.01) discard;
          gl_FragColor = vec4(vec3(1.0, 0.85, 0.6) * a, a);
        }`,
    }),
  },
};

/** Add a disk of the given kind to the scene. Set its look through mesh.material.uniforms. */
export function addDisk(kind, center, radius) {
  const k = KINDS[kind];
  const mesh = new THREE.Mesh(diskGeometry(center, radius, k.rings, k.segs, k.lift), k.material.clone());
  mesh.renderOrder = k.renderOrder;
  scene.add(mesh);
  return mesh;
}

// Each disk's material is a clone (for its own uniforms) that shares one shader program with its kind.
// Disposing the last live clone makes three.js delete that program and recompile it for the next meteor
// (a 50-130 ms hitch on the Pi 5), so only the geometry is freed; the clones hold no other GPU resources.
export function removeDisk(mesh) { scene.remove(mesh); mesh.geometry.dispose(); }
