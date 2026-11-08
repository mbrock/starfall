// Every hat Pip can wear. build(g) adds the hat's meshes to g (Pip's head top is at y ≈ 0.4) and returns
// the material that tinted variants recolor. tints become extra shop items named "<tint> <tintName>".
// To add a hat, add an entry here; the shop picks it up from game/cosmetics.js.
import * as THREE from 'three';
import { mat } from '../engine/materials.js';

const smooth = (color, extra) => mat(color, { flatShading: false, ...extra });
const goldM = smooth(0xffcf5a, { metalness: 0.6, roughness: 0.3 });
const M = (g, geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };

export const HATS = {
  none: { name: 'No hat', price: 0, showsAntenna: true, build() { return null; } },
  sprout: {
    name: 'Sprout', price: 20, tintName: 'sprout', tintPrice: 25, tints: [['Autumn', 0xff8a3a], ['Blossom', 0xff9ad5]],
    build(g) {
      const leaf = smooth(0x5fd38a);
      M(g, new THREE.CylinderGeometry(0.015, 0.02, 0.18, 5), leaf, 0, 0.47, 0);
      for (const s of [-1, 1]) { const l = M(g, new THREE.SphereGeometry(0.1, 10, 8), leaf, 0.09 * s, 0.57, 0); l.scale.set(1, 0.35, 0.6); l.rotation.z = 0.5 * s; }
      return leaf;
    },
  },
  party: {
    name: 'Party hat', price: 25, tintName: 'party hat', tintPrice: 30, tints: [['Mint', 0x6ef0c2], ['Red', 0xff5a6e], ['Gold', 0xffcf5a], ['Blue', 0x5ab8ff], ['Pink', 0xff9ad5]],
    build(g) {
      const m = smooth(0x9a7bff);
      M(g, new THREE.ConeGeometry(0.17, 0.42, 14), m, 0, 0.55, 0).rotation.z = -0.2;
      M(g, new THREE.SphereGeometry(0.06, 8, 6), goldM, 0.042, 0.76, 0);
      return m;
    },
  },
  halo: {
    name: 'Halo', price: 40, showsAntenna: true, spins: true, tintName: 'halo', tintPrice: 45, tints: [['Blue', 0x8ad8ff], ['Pink', 0xffa8d8], ['Green', 0xa8ffb8]],
    build(g) {
      const m = new THREE.MeshBasicMaterial({ color: 0xffe08a });
      M(g, new THREE.TorusGeometry(0.2, 0.03, 8, 32), m, 0, 0.9, 0).rotation.x = Math.PI / 2;
      return m;
    },
  },
  wizard: {
    name: 'Wizard hat', price: 45, tintName: 'wizard hat', tintPrice: 50, tints: [['Red', 0xa8233f], ['Green', 0x2e6b4a], ['Blue', 0x1f4fa8], ['White', 0xe8e8f8]],
    build(g) {
      const m = smooth(0x2a2160);
      M(g, new THREE.CylinderGeometry(0.34, 0.34, 0.03, 20), m, 0, 0.36, 0);
      M(g, new THREE.ConeGeometry(0.2, 0.55, 16), m, 0, 0.64, 0).rotation.z = 0.25;
      M(g, new THREE.OctahedronGeometry(0.05, 0), new THREE.MeshBasicMaterial({ color: 0xffcf5a }), 0.13, 0.62, 0.15);
      return m;
    },
  },
  cat: {
    name: 'Cat ears', price: 30, tintName: 'cat ears', tintPrice: 35, tints: [['Orange', 0xff8a3a], ['White', 0xf4f0ff], ['Black', 0x1d1a2e], ['Gray', 0x8a88a0]],
    build(g) {
      const m = smooth(0x3a3570), inner = smooth(0xff9ad5);
      for (const s of [-1, 1]) {
        const e = M(g, new THREE.ConeGeometry(0.11, 0.22, 4), m, 0.2 * s, 0.42, 0); e.rotation.z = -0.45 * s; e.rotation.y = Math.PI / 4;
        const i = M(g, new THREE.ConeGeometry(0.06, 0.13, 4), inner, 0.2 * s, 0.41, 0.03); i.rotation.z = -0.45 * s; i.rotation.y = Math.PI / 4;
      }
      return m;
    },
  },
  bunny: {
    name: 'Bunny ears', price: 30, tintName: 'bunny ears', tintPrice: 35, tints: [['Brown', 0x9a6a4a], ['Gray', 0x9a98b0], ['Pink', 0xffb8d8]],
    build(g) {
      const m = smooth(0xf4f0ff), inner = smooth(0xffb3d1);
      for (const s of [-1, 1]) {
        const e = M(g, new THREE.SphereGeometry(0.08, 10, 8), m, 0.12 * s, 0.62, 0); e.scale.set(0.8, 3, 0.5); e.rotation.z = -0.2 * s;
        const i = M(g, new THREE.SphereGeometry(0.045, 8, 6), inner, 0.12 * s, 0.62, 0.03); i.scale.set(0.8, 3.4, 0.4); i.rotation.z = -0.2 * s;
      }
      return m;
    },
  },
  tophat: {
    name: 'Top hat', price: 50, tintName: 'top hat', tintPrice: 55, tints: [['White', 0xf4f0ff], ['Red', 0xa8233f], ['Purple', 0x5a3aa8], ['Gold', 0xffcf5a]],
    build(g) {
      const m = smooth(0x1d1a2e, { roughness: 0.5 });
      M(g, new THREE.CylinderGeometry(0.3, 0.3, 0.03, 20), m, 0, 0.37, 0);
      M(g, new THREE.CylinderGeometry(0.19, 0.19, 0.34, 20), m, 0, 0.55, 0);
      M(g, new THREE.CylinderGeometry(0.195, 0.195, 0.06, 20), smooth(0xff5a6e), 0, 0.42, 0);
      return m;
    },
  },
  crown: {
    name: 'Crown', price: 60, tintName: 'crown', tintPrice: 70, tints: [['Silver', 0xd8dde8], ['Rose gold', 0xffb8a0]],
    build(g) {
      const m = new THREE.MeshStandardMaterial({ color: 0xffcf5a, metalness: 0.6, roughness: 0.3, side: THREE.DoubleSide });
      M(g, new THREE.CylinderGeometry(0.21, 0.23, 0.13, 12, 1, true), m, 0, 0.42, 0);
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; M(g, new THREE.ConeGeometry(0.045, 0.12, 5), goldM, Math.cos(a) * 0.21, 0.54, Math.sin(a) * 0.21); }
      M(g, new THREE.OctahedronGeometry(0.05, 0), new THREE.MeshBasicMaterial({ color: 0xff5a6e }), 0, 0.42, 0.23);
      return m;
    },
  },
};
