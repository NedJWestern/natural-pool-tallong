import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import GUI from 'lil-gui';
import { config } from './config.js';

// Working copy of the parameters, edited by the GUI.
const params = structuredClone(config);

// ---------- renderer, scene, camera ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
Object.assign(labelRenderer.domElement.style, { position: 'fixed', top: '0', left: '0', pointerEvents: 'none' });
document.body.appendChild(labelRenderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfd9ea);
scene.fog = new THREE.Fog(0xbfd9ea, 40, 100);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.05, 300);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = false; // stop as soon as the mouse is released
controls.maxPolarAngle = Math.PI * 0.495;

scene.add(new THREE.HemisphereLight(0xdfefff, 0x5a6b3a, 0.9));
const sun = new THREE.DirectionalLight(0xfff3dd, 2.2);
sun.position.set(-8, 20, 9);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 });
sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);

// ---------- materials ----------
const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.95, ...extra });
const mat = {
  lawn: std(0x6f9a45, { roughness: 1 }),
  gravel: std(0xa08d6a, { roughness: 1 }),
  soil: std(0x6b5a40, { roughness: 1 }),
  swimFloor: std(0x3e4a48, { roughness: 0.9 }),
  wall: std(0x55605d, { roughness: 0.85 }),
  coping: std(0xb3ada2),
  ledge: std(0x9d978c),
  concrete: std(0x8a8a86),
  lid: std(0x5c5f60, { roughness: 0.7 }),
  water: new THREE.MeshPhysicalMaterial({
    color: 0x2c6e70, transparent: true, opacity: 0.55, roughness: 0.06,
    clearcoat: 1, depthWrite: false, side: THREE.DoubleSide,
  }),
  cascade: new THREE.MeshPhysicalMaterial({
    color: 0xcfe6ea, transparent: true, opacity: 0.6, roughness: 0.1,
    clearcoat: 1, depthWrite: false, side: THREE.DoubleSide,
  }),
  deck: [0x9c6b43, 0xa47249, 0x93633d].map(c => std(c, { roughness: 0.8 })),
  deckFrame: std(0x3d2f22, { roughness: 1 }),
  steel: std(0xc9ced1, { metalness: 0.9, roughness: 0.25 }),
  reed: [0x5f8a3a, 0x6f9840, 0x557c33].map(c => std(c, { roughness: 0.9 })),
  cattail: std(0x5a3a22, { roughness: 1 }),
  lily: std(0x3f7d36, { roughness: 0.6, side: THREE.DoubleSide }),
  flower: std(0xf2a6c2, { roughness: 0.7 }),
  flowerCentre: std(0xf5d142, { roughness: 0.7 }),
  grass: [0x7fa04a, 0x92a85a, 0x6c8f3d].map(c => std(c, { roughness: 1, flatShading: true })),
  trunk: std(0x5b4432, { roughness: 1 }),
  foliage: [0x4c7a35, 0x5a8a3c, 0x3f6b2f].map(c => std(c, { roughness: 1, flatShading: true })),
};

// ---------- helpers ----------
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];
const smoothstep = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };

const mesh = (geo, material, { cast = true, receive = true } = {}) => {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = cast; m.receiveShadow = receive;
  return m;
};

// Axis-aligned box from min/max extents.
function boxBetween(x0, x1, y0, y1, z0, z1, material, opts) {
  const b = mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), material, opts);
  b.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return b;
}

function label(text, x, y, z) {
  const el = document.createElement('div');
  el.className = 'label';
  el.textContent = text;
  const o = new CSS2DObject(el);
  o.position.set(x, y, z);
  return o;
}

// ---------- scene construction ----------
let poolGroup = null;

function build(p) {
  if (poolGroup) {
    scene.remove(poolGroup);
    poolGroup.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.isCSS2DObject) o.element.remove();
    });
  }
  const g = new THREE.Group();
  g.name = 'NaturalPool';
  poolGroup = g;
  const add = (...objs) => { g.add(...objs); return objs[0]; };
  const rnd = mulberry32(p.planting.seed);

  const W = p.pool.width, L = p.pool.length, t = p.pool.wallThickness;
  const hx = W / 2, hz = L / 2;
  const D = p.deep.depth;
  const dz0 = Math.max(-hz + 0.5, Math.min(p.deep.from, p.deep.to - 1));
  const dz1 = Math.min(hz - 0.5, Math.max(p.deep.to, dz0 + 1));
  const sh = Math.min(p.shallow.depth, D - 0.2);
  const wl = p.waterLevel;
  const bedW = Math.min(p.plantBeds.width, W / 2 - 0.3);
  const bedTop = -Math.min(p.plantBeds.topDepth, sh - 0.05);

  // Seat / spillway (downhill, +x side) and the drain outside it
  const spL = Math.min(p.spillway.length, dz1 - dz0);
  const spZ0 = Math.max(dz0, Math.min(dz1 - spL, p.spillway.centre - spL / 2));
  const spZ1 = spZ0 + spL;
  const seatW = Math.min(p.spillway.seatWidth, W / 2);
  const seatTop = -Math.min(p.spillway.seatDepth, D - 0.2);
  const drW = Math.max(0.15, p.drain.width), drD = Math.max(0.1, p.drain.depth);
  const drX0 = hx + t, drX1 = hx + t + drW;
  const drainWater = -drD + 0.07;

  // Dock and filter (uphill, -x side)
  const dock = { x0: -hx - p.dock.depth, x1: -hx + 0.06, z0: p.dock.centre - p.dock.length / 2, z1: p.dock.centre + p.dock.length / 2 };
  const filt = { x0: -hx - t - p.filter.depth, x1: -hx - t, z0: p.filter.centre - p.filter.length / 2, z1: p.filter.centre + p.filter.length / 2 };

  // ---- terrain ----
  // Natural ground falls towards +x. Around the pool, dock and filter it is levelled to a
  // terrace at y = 0, blending back to the natural slope (quickly on the downhill side).
  const terrace = {
    x0: Math.min(dock.x0, filt.x0) - 1.2, x1: drX1,
    z0: -hz - t - 1.5, z1: hz + t + 1.5,
  };
  const natural = (x, z) => -p.site.slope * x + 0.07 * Math.sin(x * 0.31 + z * 0.17) + 0.05 * Math.sin(z * 0.43 - x * 0.12);
  const lowEdge = wl - 0.06; // drain kerb and downhill ground start here
  const heightAt = (x, z) => {
    const ux = Math.max(0, terrace.x0 - x) / 3.0;
    const dx = Math.max(0, x - terrace.x1) / 0.7;
    const zz = Math.max(0, terrace.z0 - z, z - terrace.z1) / 3.0;
    // Downhill of the drain the ground starts below the spillway lip, so nothing
    // rises above the water's edge in the view (infinity-edge effect).
    const base = x >= terrace.x1 - 1e-6 ? lowEdge : 0;
    return base + (natural(x, z) - base) * smoothstep(Math.hypot(ux, dx, zz));
  };
  {
    const size = 64, seg = 256;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    // Pool opening: triangles entirely inside are dropped; inside vertices of the
    // triangles straddling the edge are snapped onto it.
    const hole = { x0: -hx - t, x1: drX1, z0: -hz - t, z1: hz + t };
    const inside = new Uint8Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i), z = pos.getZ(i);
      if (x > hole.x0 && x < hole.x1 && z > hole.z0 && z < hole.z1) {
        inside[i] = 1;
        const d = [x - hole.x0, hole.x1 - x, z - hole.z0, hole.z1 - z];
        const m = d.indexOf(Math.min(...d));
        if (m === 0) x = hole.x0; else if (m === 1) x = hole.x1; else if (m === 2) z = hole.z0; else z = hole.z1;
      }
      pos.setXYZ(i, x, heightAt(x, z), z);
    }
    const idx = geo.index.array, kept = [];
    for (let i = 0; i < idx.length; i += 3) {
      if (!(inside[idx[i]] && inside[idx[i + 1]] && inside[idx[i + 2]])) kept.push(idx[i], idx[i + 1], idx[i + 2]);
    }
    geo.setIndex(kept);
    geo.computeVertexNormals();
    add(mesh(geo, mat.lawn, { cast: false }));
  }

  // ---- pool structure ----
  // Side walls (run the full length, including corners)
  add(boxBetween(-hx - t, -hx, -D, 0, -hz - t, hz + t, mat.wall));
  add(boxBetween(hx, hx + t, -D, 0, -hz - t, spZ0, mat.wall));
  add(boxBetween(hx, hx + t, -D, 0, spZ1, hz + t, mat.wall));
  // Spillway: the wall is lowered to water level above the seat
  add(boxBetween(hx, hx + t, -D, wl, spZ0, spZ1, mat.ledge));
  // Seat along the inside of the downhill wall
  add(boxBetween(hx - seatW, hx, -D, seatTop, spZ0, spZ1, mat.ledge));
  // End walls
  add(boxBetween(-hx, hx, -D, 0, -hz - t, -hz, mat.wall));
  add(boxBetween(-hx, hx, -D, 0, hz, hz + t, mat.wall));
  // Deep zone floor
  const floor = add(mesh(new THREE.PlaneGeometry(W, dz1 - dz0), mat.swimFloor, { cast: false }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -D, (dz0 + dz1) / 2);
  // Shallow ends: solid fill with a gravel top; the side faces form the steps down to the deep zone
  const fillMats = [mat.wall, mat.wall, mat.gravel, mat.wall, mat.wall, mat.wall];
  add(boxBetween(-hx, hx, -D, -sh, -hz, dz0, fillMats));
  add(boxBetween(-hx, hx, -D, -sh, dz1, hz, fillMats));
  // Planted beds in the four corners
  const beds = [];
  const bedLen0 = Math.min(p.plantBeds.length, dz0 + hz - 0.05);
  const bedLen1 = Math.min(p.plantBeds.length, hz - dz1 - 0.05);
  for (const [x0, x1] of [[-hx, -hx + bedW], [hx - bedW, hx]]) {
    beds.push({ x0, x1, z0: -hz, z1: -hz + bedLen0 }, { x0, x1, z0: hz - bedLen1, z1: hz });
  }
  if (p.plantBeds.endStrip > 0) {
    const sd = Math.min(p.plantBeds.endStrip, hz - dz1 - 0.3);
    beds.push({ x0: -hx + bedW, x1: hx - bedW, z0: hz - sd, z1: hz });
  }
  for (const b of beds) add(boxBetween(b.x0, b.x1, -sh, bedTop, b.z0, b.z1, mat.soil));

  // Entry steps into the shallow entrance end (-z)
  if (p.shallow.entrySteps) {
    const sw = Math.min(1.6, W - 2 * bedW - 0.2), n = 2, tread = 0.32;
    for (let i = 0; i < n; i++) {
      const top = -sh * (i + 1) / (n + 1);
      add(boxBetween(-sw / 2, sw / 2, -sh, top, -hz, -hz + tread * (n - i), mat.ledge));
    }
  }

  // Coping stones around the top of the walls (not over the spillway).
  // On the downhill side they also close off the ground beside the drain.
  const cy0 = -0.01, cy1 = 0.06, ov = 0.06, out = 0.12;
  add(boxBetween(-hx - t - out, -hx + ov, cy0, cy1, -hz - t - out, hz + t + out, mat.coping));
  add(boxBetween(hx - ov, drX1 + out, -drD - 0.1, cy1, -hz - t - out, dz0, mat.coping));
  add(boxBetween(hx - ov, drX1 + out, -drD - 0.1, cy1, dz1, hz + t + out, mat.coping));
  add(boxBetween(hx - ov, hx + t + 0.03, cy0, cy1, dz0, spZ0, mat.coping));
  add(boxBetween(hx - ov, hx + t + 0.03, cy0, cy1, spZ1, dz1, mat.coping));
  add(boxBetween(-hx + ov, hx - ov, cy0, cy1, -hz - t - out, -hz + ov, mat.coping));
  add(boxBetween(-hx + ov, hx - ov, cy0, cy1, hz - ov, hz + t + out, mat.coping));

  // Drain channel: gravel floor, low stone kerb on the outer side, a little water
  add(boxBetween(drX0, drX1, -drD - 0.1, -drD, dz0, dz1, mat.gravel));
  add(boxBetween(drX1 - 0.08, drX1 + 0.02, -drD, lowEdge, dz0, dz1, mat.coping)); // kerb below the lip

  // Water surfaces: pool, drain, and the sheet falling over the spillway into the drain
  const waterPlane = (w, l, x, y, z) => {
    const m = add(mesh(new THREE.PlaneGeometry(w, l), mat.water, { cast: false, receive: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.renderOrder = 10;
  };
  waterPlane(W, L, 0, wl, 0);
  waterPlane(t, spL, hx + t / 2, wl + 0.008, (spZ0 + spZ1) / 2);
  waterPlane(drW - 0.08, dz1 - dz0, (drX0 + drX1 - 0.08) / 2, drainWater, (dz0 + dz1) / 2);
  {
    const sheet = add(mesh(new THREE.PlaneGeometry(spL, wl - drainWater), mat.cascade, { cast: false, receive: false }));
    sheet.rotation.y = Math.PI / 2;
    sheet.position.set(hx + t + 0.01, (wl + drainWater) / 2, (spZ0 + spZ1) / 2);
    sheet.renderOrder = 11;
  }

  // Outlet pipe from the drain, emerging further down the bank
  {
    const zc = (dz0 + dz1) / 2;
    let xo = drX1 + 0.6;
    while (heightAt(xo, zc) > drainWater - 0.25 && xo < drX1 + 4) xo += 0.1; // until it clears the ground
    const yp = -drD - 0.02;
    const len = xo - drX0;
    const pipe = add(mesh(new THREE.CylinderGeometry(0.06, 0.06, len, 12), mat.concrete));
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(drX0 + len / 2, yp, zc);
    const yg = heightAt(xo + 0.1, zc);
    const fall = add(mesh(new THREE.CylinderGeometry(0.04, 0.07, yp - yg, 10, 1, true), mat.cascade, { cast: false, receive: false }));
    fall.position.set(xo + 0.05, (yp + yg) / 2, zc);
    fall.renderOrder = 11;
  }

  // ---- dock ----
  {
    const top = 0.18, boardW = 0.14, gap = 0.008;
    for (let z = dock.z0; z + boardW <= dock.z1 + 1e-6; z += boardW + gap) {
      add(boxBetween(dock.x0, dock.x1, top - 0.03, top, z, z + boardW, pick(rnd, mat.deck)));
    }
    add(boxBetween(dock.x0 + 0.05, -hx - t, -0.05, top - 0.03, dock.z0 + 0.05, dock.z1 - 0.05, mat.deckFrame));

    // Ladder from the dock into the deep zone
    const lz = Math.max(dz0 + 0.6, Math.min(dz1 - 0.6, p.dock.centre - 0.7));
    const rx = -hx + 0.2;
    for (const dzl of [-0.25, 0.25]) {
      const path = new THREE.CatmullRomCurve3([
        new THREE.Vector3(rx, -1.3, lz + dzl), new THREE.Vector3(rx, top + 0.55, lz + dzl),
        new THREE.Vector3(rx - 0.12, top + 0.82, lz + dzl), new THREE.Vector3(-hx - 0.3, top + 0.82, lz + dzl),
        new THREE.Vector3(-hx - 0.42, top + 0.6, lz + dzl), new THREE.Vector3(-hx - 0.42, top, lz + dzl),
      ], false, 'centripetal', 0.3);
      add(mesh(new THREE.TubeGeometry(path, 60, 0.022, 10), mat.steel));
    }
    for (let y = -1.1; y < -0.05; y += 0.3) add(boxBetween(rx - 0.025, rx + 0.065, y, y + 0.025, lz - 0.25, lz + 0.25, mat.steel));
  }

  // ---- filter chamber ----
  add(boxBetween(filt.x0, filt.x1, -0.3, p.filter.height, filt.z0, filt.z1, mat.concrete));
  add(boxBetween(filt.x0 + 0.12, filt.x1 - 0.12, p.filter.height, p.filter.height + 0.03, filt.z0 + 0.12, filt.z1 - 0.12, mat.lid));
  // Pipe from the filter into the pool
  {
    const pipe = add(mesh(new THREE.CylinderGeometry(0.05, 0.05, t + 0.3, 12), mat.concrete));
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(-hx - t / 2 + 0.05, -0.3, (filt.z0 + filt.z1) / 2);
  }

  // ---- planting ----
  const stemGeo = new THREE.CylinderGeometry(0.006, 0.013, 1, 5);
  stemGeo.translate(0, 0.5, 0);
  const headGeo = new THREE.CapsuleGeometry(0.028, 0.16, 3, 8);
  for (const b of beds) {
    for (let c = 0; c < p.planting.reedsPerBed; c++) {
      const cx = b.x0 + 0.25 + rnd() * (b.x1 - b.x0 - 0.5);
      const cz = b.z0 + 0.25 + rnd() * (b.z1 - b.z0 - 0.5);
      const n = 8 + Math.floor(rnd() * 12);
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 0.3;
        const h = 0.9 + rnd() * 0.8;
        const s = add(mesh(stemGeo, pick(rnd, mat.reed), { receive: false }));
        s.scale.set(1, h, 1);
        s.position.set(cx + Math.cos(a) * r, bedTop, cz + Math.sin(a) * r);
        s.rotation.set((rnd() - 0.5) * 0.25, 0, (rnd() - 0.5) * 0.25);
        if (rnd() < 0.3) {
          const head = mesh(headGeo, mat.cattail, { receive: false });
          head.position.set(0, 0.85, 0);
          head.scale.set(1, 1 / h, 1);
          s.add(head);
        }
      }
    }
  }

  // Water lilies in the open shallow area at the planted (+z) end; the entrance end stays clear
  const lilyGeo = new THREE.CircleGeometry(1, 24, 0.25, Math.PI * 2 - 0.5);
  lilyGeo.rotateX(-Math.PI / 2);
  const petalGeo = new THREE.SphereGeometry(0.07, 10, 6);
  const centreGeo = new THREE.SphereGeometry(0.025, 8, 6);
  const openX = hx - bedW - 0.25;
  const stripD = p.plantBeds.endStrip > 0 ? beds[beds.length - 1].z1 - beds[beds.length - 1].z0 : 0;
  const ends = [[dz1 + 0.3, hz - stripD - 0.3]].filter(([a, b]) => b > a);
  for (let i = 0; i < p.planting.lilyPads && ends.length && openX > 0; i++) {
    const [a, b] = ends[i % ends.length];
    const x = (rnd() * 2 - 1) * openX, z = a + rnd() * (b - a);
    const r = 0.12 + rnd() * 0.12;
    const pad = add(mesh(lilyGeo, mat.lily, { cast: false }));
    pad.scale.setScalar(r);
    pad.position.set(x, wl + 0.008, z);
    pad.rotation.y = rnd() * Math.PI * 2;
    if (rnd() < 0.3) {
      const f = add(mesh(petalGeo, mat.flower));
      f.scale.set(1, 0.5, 1);
      f.position.set(x, wl + 0.04, z);
      add(mesh(centreGeo, mat.flowerCentre)).position.set(x, wl + 0.07, z);
    }
  }

  // Grasses around the terrace edge
  if (p.planting.edgeGrasses) {
    const grassGeo = new THREE.ConeGeometry(0.04, 1, 4);
    grassGeo.translate(0, 0.5, 0);
    const inRect = (x, z, r, m) => x > r.x0 - m && x < r.x1 + m && z > r.z0 - m && z < r.z1 + m;
    const poolRect = { x0: -hx - t, x1: drX1, z0: -hz - t, z1: hz + t };
    let placed = 0;
    for (let tries = 0; tries < 600 && placed < 26; tries++) {
      const x = -hx - 4 + rnd() * (W + 6), z = -hz - 2.5 + rnd() * (L + 5);
      if (inRect(x, z, poolRect, 0.4) || inRect(x, z, dock, 0.3) || inRect(x, z, filt, 0.3)) continue;
      if (x > drX1 - 0.2 && z > dz0 - 1 && z < dz1 + 1) continue; // keep the view from the seat clear
      if (!inRect(x, z, poolRect, 2.2)) continue;
      placed++;
      const m = pick(rnd, mat.grass);
      for (let k = 0; k < 14; k++) {
        const bx = x + (rnd() - 0.5) * 0.25, bz = z + (rnd() - 0.5) * 0.25;
        const blade = add(mesh(grassGeo, m, { receive: false }));
        blade.scale.set(1, 0.35 + rnd() * 0.45, 1);
        blade.position.set(bx, heightAt(bx, bz) - 0.02, bz);
        blade.rotation.set((rnd() - 0.5) * 0.9, 0, (rnd() - 0.5) * 0.9);
      }
    }
  }

  // Trees
  const trunkGeo = new THREE.CylinderGeometry(0.12, 0.18, 1, 8);
  trunkGeo.translate(0, 0.5, 0);
  const crownGeo = new THREE.IcosahedronGeometry(1, 1);
  for (const tr of p.trees) {
    const y = heightAt(tr.x, tr.z);
    const h = 2.2 + rnd() * 1.2;
    const trunk = add(mesh(trunkGeo, mat.trunk));
    trunk.scale.set(1, h, 1);
    trunk.position.set(tr.x, y - 0.1, tr.z);
    const crown = add(mesh(crownGeo, pick(rnd, mat.foliage)));
    crown.scale.set(tr.radius, tr.radius * 1.1, tr.radius);
    crown.position.set(tr.x, y + h + tr.radius * 0.7, tr.z);
  }

  // ---- labels (matching the drawing) ----
  if (p.showLabels) {
    add(
      label('deep', 0, wl + 0.05, (dz0 + dz1) / 2),
      label('shallow · entrance for kids', 0, wl + 0.05, (-hz + dz0) / 2),
      label('shallow', 0, wl + 0.05, (dz1 + hz) / 2),
      label('plants', (beds[0].x0 + beds[0].x1) / 2, 1.2, (beds[0].z0 + beds[0].z1) / 2),
      label('seat / spillway', hx - seatW / 2, 0.25, (spZ0 + spZ1) / 2),
      label('drain', (drX0 + drX1) / 2, 0.25, dz1 - 0.6),
      label('dock', (dock.x0 + dock.x1) / 2, 0.45, (dock.z0 + dock.z1) / 2),
      label('filter', (filt.x0 + filt.x1) / 2, p.filter.height + 0.3, (filt.z0 + filt.z1) / 2),
    );
    for (const tr of p.trees) add(label('tree', tr.x, heightAt(tr.x, tr.z) + 4.5, tr.z));
  }

  scene.add(g);

  // ---- stats ----
  const area = W * L;
  const deepArea = W * (dz1 - dz0);
  const bedArea = beds.reduce((s, b) => s + (b.x1 - b.x0) * (b.z1 - b.z0), 0);
  const shallowOpen = area - deepArea - bedArea;
  const volume = deepArea * (D + wl) + shallowOpen * (sh + wl) + bedArea * Math.max(0, -bedTop + wl);
  document.getElementById('stats').innerHTML = `
    <b>Pool</b> ${W.toFixed(1)} × ${L.toFixed(1)} m (${area.toFixed(1)} m²)<br>
    <b>Deep zone</b> ${deepArea.toFixed(1)} m², ${(D + wl).toFixed(2)} m water depth<br>
    <b>Shallow (open)</b> ${shallowOpen.toFixed(1)} m², ${(sh + wl).toFixed(2)} m deep<br>
    <b>Planted beds</b> ${bedArea.toFixed(1)} m² (${Math.round((bedArea / area) * 100)} % of surface)<br>
    <b>Approx. water volume</b> ${volume.toFixed(1)} m³ (${Math.round(volume * 1000).toLocaleString('en-GB')} L)<br>
    <b>Fall across site</b> ${(p.site.slope * 100).toFixed(0)} % towards the spillway`;

  return { span: Math.max(W, L) };
}

// ---------- camera framing ----------
function frame({ span }) {
  controls.target.set(0, -0.3, 0);
  camera.position.set(span * 1.0, span * 0.65, span * 0.75);
  controls.update();
}

let info = build(params);
frame(info);
window.pool = { camera, controls, params }; // handy for poking at the scene from the browser console

// ---------- GUI ----------
const gui = new GUI({ title: 'Pool design' });
const rebuild = () => { info = build(params); };
const fp = gui.addFolder('Pool');
fp.add(params.pool, 'width', 3, 10, 0.05).onChange(rebuild);
fp.add(params.pool, 'length', 5, 20, 0.05).onChange(rebuild);
fp.add(params.deep, 'from', -8, 8, 0.05).name('deep zone from').onChange(rebuild);
fp.add(params.deep, 'to', -8, 8, 0.05).name('deep zone to').onChange(rebuild);
fp.add(params.deep, 'depth', 1, 3, 0.05).name('deep depth').onChange(rebuild);
fp.add(params.shallow, 'depth', 0.2, 1, 0.05).name('shallow depth').onChange(rebuild);
fp.add(params.shallow, 'entrySteps').name('entry steps').onChange(rebuild);
fp.add(params, 'waterLevel', -0.3, 0, 0.01).name('water level').onChange(rebuild);
const fb = gui.addFolder('Planted beds');
fb.add(params.plantBeds, 'width', 0.3, 3, 0.05).onChange(rebuild);
fb.add(params.plantBeds, 'length', 0.3, 6, 0.05).onChange(rebuild);
fb.add(params.plantBeds, 'endStrip', 0, 3, 0.05).name('end strip').onChange(rebuild);
fb.add(params.plantBeds, 'topDepth', 0.05, 0.6, 0.01).name('top depth').onChange(rebuild);
fb.add(params.planting, 'reedsPerBed', 0, 15, 1).name('reed clumps').onChange(rebuild);
fb.add(params.planting, 'lilyPads', 0, 60, 1).name('lily pads').onChange(rebuild);
const ff = gui.addFolder('Spillway, dock, filter');
ff.add(params.spillway, 'centre', -6, 6, 0.05).name('spillway centre').onChange(rebuild);
ff.add(params.spillway, 'length', 0.5, 10, 0.05).name('spillway length').onChange(rebuild);
ff.add(params.spillway, 'seatWidth', 0.2, 1.2, 0.05).name('seat width').onChange(rebuild);
ff.add(params.spillway, 'seatDepth', 0.2, 1.2, 0.05).name('seat depth').onChange(rebuild);
ff.add(params.drain, 'width', 0.15, 1.2, 0.05).name('drain width').onChange(rebuild);
ff.add(params.drain, 'depth', 0.1, 0.8, 0.05).name('drain depth').onChange(rebuild);
ff.add(params.dock, 'centre', -6, 6, 0.05).name('dock centre').onChange(rebuild);
ff.add(params.dock, 'length', 1, 8, 0.05).name('dock length').onChange(rebuild);
ff.add(params.dock, 'depth', 0.5, 5, 0.05).name('dock depth').onChange(rebuild);
ff.add(params.filter, 'centre', -6, 6, 0.05).name('filter centre').onChange(rebuild);
const fs = gui.addFolder('Site');
fs.add(params.site, 'slope', 0, 0.4, 0.01).onChange(rebuild);
fs.add(params.planting, 'edgeGrasses').name('edge grasses').onChange(rebuild);
fs.add(params.planting, 'seed', 1, 999, 1).onChange(rebuild);
fs.add(params, 'showLabels').name('labels').onChange(rebuild);
fb.close(); ff.close(); fs.close();

gui.add({ reframe: () => frame(info) }, 'reframe').name('Reset camera');
gui.add({
  copy: async () => {
    const text = `export const config = ${JSON.stringify(params, null, 2)};\n`;
    try { await navigator.clipboard.writeText(text); alert('Settings copied — paste into src/config.js'); }
    catch { console.log(text); alert('Clipboard unavailable; settings printed to the browser console.'); }
  },
}, 'copy').name('Copy settings');
gui.add({
  exportGltf: () => {
    new GLTFExporter().parse(poolGroup, (result) => {
      const blob = new Blob([result], { type: 'model/gltf-binary' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'natural-pool.glb';
      a.click();
      URL.revokeObjectURL(a.href);
    }, (err) => alert('Export failed: ' + err), { binary: true });
  },
}, 'exportGltf').name('Export .glb');

// ---------- loop ----------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
});
renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
});
