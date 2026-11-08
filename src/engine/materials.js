// Shared textures, materials and colors.
import * as THREE from 'three';

/** A square canvas texture filled with a radial gradient; stops are [offset, css color] pairs. */
export function radialTexture(size, stops) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), h = size / 2;
  const gr = g.createRadialGradient(h, h, 0, h, h, h);
  for (const [at, color] of stops) gr.addColorStop(at, color);
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export const glowTex = radialTexture(64, [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.55)'], [1, 'rgba(255,255,255,0)']]);

/** An additive glow sprite material. Share one per look instead of making one per object. */
export const glowMaterial = (color, opacity = 1) => new THREE.SpriteMaterial({ map: glowTex, color, opacity, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
/** A glow sprite of the given color and size. */
export function glowSprite(color, size, material = glowMaterial(color)) {
  const s = new THREE.Sprite(material); s.scale.setScalar(size); return s;
}

/** The game's standard low-poly material. */
export const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, ...extra });

export const COLORS = {
  gold: new THREE.Color(0xffc24a), mint: new THREE.Color(0x6ef0c2), ember: new THREE.Color(0xff7a2a),
  coral: new THREE.Color(0xff5a6e), white: new THREE.Color(0xf4f0ff), dust: new THREE.Color(0xc9b99a), rock: new THREE.Color(0x8a7fb8),
};
