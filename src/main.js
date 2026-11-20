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

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 300);
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
  gravel: std(0xa08d6a, { roughness: 1, side: THREE.DoubleSide }),
  soil: std(0x6b5a40, { roughness: 1, side: THREE.DoubleSide }),
  swimFloor: std(0x3e4a48, { roughness: 0.9 }),
  wall: std(0x55605d, { roughness: 0.85, side: THREE.DoubleSide }), // extruded outlines: draw both faces
  coping: std(0xb3ada2, { side: THREE.DoubleSide }),
  ledge: std(0x9d978c, { side: THREE.DoubleSide }),
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
  stone: [0x8c8a85, 0x7a7670, 0x9a958c, 0x857f74].map(c => std(c, { flatShading: true })),
  irisLeaf: std(0x5d8a4a, { roughness: 0.9 }),
  iris: std(0x6a4fb0, { roughness: 0.7 }),
  shrub: [0x3f6b34, 0x4d7a3a, 0x5c7a34, 0x55803f].map(c => std(c, { roughness: 1, flatShading: true })),
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

// ---------- 2D outline helpers (points are {x, z}, counter-clockwise from +x towards +z) ----------
const dedupe = (pts) => pts.filter((q, i) => {
  const n = pts[(i + 1) % pts.length];
  return Math.hypot(q.x - n.x, q.z - n.z) > 1e-4;
});

// Rounded-rectangle perimeter with half-sizes a × b and corner radius r, starting at (a, zFrom)
// on the +x side, running round via +z, and ending at (a, zTo) on the +x side again.
function rrPath(a, b, r, zFrom, zTo, seg = 12) {
  r = Math.max(0.01, Math.min(r, a - 0.001, b - 0.001));
  const pts = [{ x: a, z: zFrom }];
  for (const [cx, cz, start] of [[a - r, b - r, 0], [-a + r, b - r, 90], [-a + r, -b + r, 180], [a - r, -b + r, 270]]) {
    for (let i = 0; i <= seg; i++) {
      const th = ((start + (90 * i) / seg) * Math.PI) / 180;
      pts.push({ x: cx + r * Math.cos(th), z: cz + r * Math.sin(th) });
    }
  }
  pts.push({ x: a, z: zTo });
  return pts;
}
const rrLoop = (a, b, r, cx = 0, cz = 0) =>
  dedupe(rrPath(a, b, r, 0, 0).slice(0, -1)).map(q => ({ x: q.x + cx, z: q.z + cz }));
const rectLoop = (x0, x1, z0, z1) => [{ x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }, { x: x0, z: z0 }];
const roundedRect = (x0, x1, z0, z1, r) => rrLoop((x1 - x0) / 2, (z1 - z0) / 2, r, (x0 + x1) / 2, (z0 + z1) / 2);

// Sutherland–Hodgman: clip a polygon by a convex counter-clockwise polygon.
function clipConvex(subject, clip) {
  let out = subject;
  for (let i = 0; i < clip.length && out.length; i++) {
    const a = clip[i], b = clip[(i + 1) % clip.length];
    const side = (q) => (b.x - a.x) * (q.z - a.z) - (b.z - a.z) * (q.x - a.x);
    const input = out; out = [];
    for (let j = 0; j < input.length; j++) {
      const c = input[j], d = input[(j + 1) % input.length];
      const sc = side(c), sd = side(d);
      if (sc >= 0) out.push(c);
      if ((sc >= 0) !== (sd >= 0)) {
        const k = sc / (sc - sd);
        out.push({ x: c.x + (d.x - c.x) * k, z: c.z + (d.z - c.z) * k });
      }
    }
  }
  return dedupe(out);
}

function polyArea(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s += a.x * b.z - b.x * a.z; }
  return Math.abs(s) / 2;
}
function pointInPoly(q, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.z > q.z) !== (b.z > q.z) && q.x < ((b.x - a.x) * (q.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

const toShape = (outer, holes = []) => {
  const sh = new THREE.Shape(outer.map(q => new THREE.Vector2(q.x, -q.z)));
  for (const h of holes) sh.holes.push(new THREE.Path(h.map(q => new THREE.Vector2(q.x, -q.z))));
  return sh;
};
// Vertical prism from an outline, between heights y0 and y1. Materials: [top/bottom, sides].
function extrudeXZ(outer, holes, y0, y1, material, opts) {
  const geo = new THREE.ExtrudeGeometry(toShape(outer, holes), { depth: y1 - y0, bevelEnabled: false, curveSegments: 1 });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, y0, 0);
  return mesh(geo, material, opts);
}
function flatXZ(outer, y, material, opts) {
  const geo = new THREE.ShapeGeometry(toShape(outer), 1);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, y, 0);
  return mesh(geo, material, opts);
}

// Rounded rectangle (centred) membership and nearest point on its edge.
function inRR(x, z, a, b, r) {
  const ax = Math.abs(x), az = Math.abs(z);
  if (ax >= a || az >= b) return false;
  const qx = ax - (a - r), qz = az - (b - r);
  return !(qx > 0 && qz > 0 && Math.hypot(qx, qz) >= r);
}
function snapRR(x, z, a, b, r) {
  const sx = Math.sign(x) || 1, sz = Math.sign(z) || 1;
  const qx = Math.abs(x) - (a - r), qz = Math.abs(z) - (b - r);
  if (qx > 0 && qz > 0) {
    const l = Math.hypot(qx, qz) || 1;
    return { x: sx * (a - r + (r * qx) / l), z: sz * (b - r + (r * qz) / l), side: 'corner' };
  }
  return a - Math.abs(x) < b - Math.abs(z) ? { x: sx * a, z, side: sx > 0 ? '+x' : '-x' } : { x, z: sz * b, side: 'end' };
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
  const seatW = Math.min(p.seat.width, W / 2);
  const seatTop = -Math.min(p.seat.depth, D - 0.2);
  const spW = Math.min(p.spillway.width, seatW - 0.1);
  const drW = Math.max(0.15, p.drain.width), drD = Math.max(0.1, p.drain.depth);
  const drX0 = hx + t, drX1 = hx + t + drW;
  const drainWater = -drD + 0.07;

  // Dock and filter (uphill, -x side)
  const dock = { x0: -hx - p.dock.depth, x1: -hx + 0.06, z0: p.dock.centre - p.dock.length / 2, z1: p.dock.centre + p.dock.length / 2 };
  const filt = { x0: -hx - t - p.filter.depth, x1: -hx - t, z0: p.filter.centre - p.filter.length / 2, z1: p.filter.centre + p.filter.length / 2 };

  // Corner radius of the pool; kept small enough that the deep zone stays a straight band.
  const Rc = Math.max(0.05, Math.min(p.pool.cornerRadius, hx - 0.05, hz - Math.max(-dz0, dz1) - 0.05));
  const inner = rrLoop(hx, hz, Rc);                     // water's edge (inside face of the walls)
  const lip = wl - 0.02; // spillway top, 2 cm under the water line (a surface exactly at water level flickers)

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
    // Downhill of the pool the ground eases down to below the spillway lip by the drain's
    // outer edge, so nothing rises above the water's edge in the view (infinity-edge effect).
    const base = x <= hx + t ? 0 : lowEdge * smoothstep((x - hx - t) / drW);
    return base + (natural(x, z) - base) * smoothstep(Math.hypot(ux, dx, zz));
  };
  {
    const size = 64, seg = 256;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    // Pool opening (outside of the walls, plus the drain notch): triangles entirely inside
    // are dropped; inside vertices of triangles straddling the edge are snapped onto it.
    const A = hx + t, B = hz + t, R = Rc + t;
    const inside = new Uint8Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i), z = pos.getZ(i);
      const inNotch = x >= A - 1e-6 && x < drX1 && z > spZ0 && z < spZ1;
      if (inNotch) {
        inside[i] = 1;
        const d = [drX1 - x, z - spZ0, spZ1 - z], m = d.indexOf(Math.min(...d));
        if (m === 0) x = drX1; else if (m === 1) z = spZ0; else z = spZ1;
      } else if (inRR(x, z, A, B, R)) {
        inside[i] = 1;
        const q = snapRR(x, z, A, B, R);
        x = q.x; z = q.z;
        if (q.side === '+x' && z > spZ0 && z < spZ1) x = drX1;
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
  // Walls: a rounded ring up to the spillway lip, then the rest of the way to ground level
  // everywhere except over the spillway, where the lowered wall is the infinity edge.
  add(extrudeXZ(rrLoop(hx + t, hz + t, Rc + t), [inner], -D, lip, mat.wall));
  add(extrudeXZ([...dedupe(rrPath(hx, hz, Rc, spZ1, spZ0)), ...dedupe(rrPath(hx + t, hz + t, Rc + t, spZ1, spZ0)).reverse()],
    [], lip, 0, mat.wall));
  // Seat along the inside of the downhill wall, the full length of the deep zone
  add(boxBetween(hx - seatW, hx, -D, seatTop, dz0, dz1, mat.ledge));
  // Spillway step at the back of the seat, its top level with the lowered wall
  add(boxBetween(hx - spW, hx, seatTop, lip, spZ0, spZ1, mat.ledge));
  // Deep zone floor
  const floor = add(mesh(new THREE.PlaneGeometry(W, dz1 - dz0), mat.swimFloor, { cast: false }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -D, (dz0 + dz1) / 2);
  // Shallow ends: solid fill with a gravel top; the side faces form the steps down to the deep zone
  const fillMats = [mat.gravel, mat.wall];
  add(extrudeXZ(clipConvex(inner, rectLoop(-hx - 1, hx + 1, -hz - 1, dz0)), [], -D, -sh, fillMats));
  add(extrudeXZ(clipConvex(inner, rectLoop(-hx - 1, hx + 1, dz1, hz + 1)), [], -D, -sh, fillMats));
  // Planted beds in the four corners (rounded inner corner; outer corner follows the pool),
  // plus the strip along the far end wall
  const beds = [];
  const rb = Math.max(0.05, Math.min(p.plantBeds.cornerRadius, bedW / 2));
  const bedLen0 = Math.min(p.plantBeds.length, dz0 + hz - 0.05);
  const bedLen1 = Math.min(p.plantBeds.length, hz - dz1 - 0.05);
  for (const [x0, x1, ex0, ex1] of [[-hx, -hx + bedW, -hx - 1, -hx + bedW], [hx - bedW, hx, hx - bedW, hx + 1]]) {
    beds.push({ x0, x1, z0: -hz, z1: -hz + bedLen0, poly: clipConvex(roundedRect(ex0, ex1, -hz - 1, -hz + bedLen0, rb), inner) });
    beds.push({ x0, x1, z0: hz - bedLen1, z1: hz, poly: clipConvex(roundedRect(ex0, ex1, hz - bedLen1, hz + 1, rb), inner) });
  }
  if (p.plantBeds.endStrip > 0) {
    const sd = Math.min(p.plantBeds.endStrip, hz - dz1 - 0.3);
    beds.push({ x0: -hx + bedW, x1: hx - bedW, z0: hz - sd, z1: hz, poly: clipConvex(rectLoop(-hx + bedW, hx - bedW, hz - sd, hz + 1), inner) });
  }
  for (const b of beds) add(extrudeXZ(b.poly, [], -sh, bedTop, mat.soil));

  // Entry steps into the shallow entrance end (-z)
  if (p.shallow.entrySteps) {
    const sw = Math.min(1.6, W - 2 * bedW - 0.2), n = 2, tread = 0.32;
    for (let i = 0; i < n; i++) {
      const top = -sh * (i + 1) / (n + 1);
      add(extrudeXZ(clipConvex(rectLoop(-sw / 2, sw / 2, -hz - 1, -hz + tread * (n - i)), inner), [], -sh, top, mat.ledge));
    }
  }

  // Coping stones around the top of the walls, following the rounded corners (not over the spillway)
  const cy0 = -0.15, cy1 = 0.06, ov = 0.06, out = 0.12;
  add(extrudeXZ([
    ...dedupe(rrPath(hx - ov, hz - ov, Rc - ov, spZ1, spZ0)),
    ...dedupe(rrPath(hx + t + out, hz + t + out, Rc + t + out, spZ1, spZ0)).reverse(),
  ], [], cy0, cy1, mat.coping));

  // Drain channel: gravel floor, low stone kerb on the outer side, end caps, a little water
  add(boxBetween(drX0, drX1, -drD - 0.1, -drD, spZ0, spZ1, mat.gravel));
  add(boxBetween(drX1 - 0.08, drX1 + 0.02, -drD, lowEdge, spZ0, spZ1, mat.coping)); // kerb below the lip
  add(boxBetween(drX0 - 0.01, drX1 + 0.02, -drD - 0.1, cy1, spZ0 - 0.12, spZ0, mat.coping));
  add(boxBetween(drX0 - 0.01, drX1 + 0.02, -drD - 0.1, cy1, spZ1, spZ1 + 0.12, mat.coping));

  // Water surfaces: pool, film over the spillway, drain, and the sheet falling into the drain
  const waterPlane = (w, l, x, y, z) => {
    const m = add(mesh(new THREE.PlaneGeometry(w, l), mat.water, { cast: false, receive: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.renderOrder = 10;
  };
  add(flatXZ(inner, wl, mat.water, { cast: false, receive: false })).renderOrder = 10;
  waterPlane(t, spL, hx + t / 2, wl, (spZ0 + spZ1) / 2);
  waterPlane(drW - 0.08, spL, (drX0 + drX1 - 0.08) / 2, drainWater, (spZ0 + spZ1) / 2);
  {
    const sheet = add(mesh(new THREE.PlaneGeometry(spL, wl - drainWater), mat.cascade, { cast: false, receive: false }));
    sheet.rotation.y = Math.PI / 2;
    sheet.position.set(hx + t + 0.01, (wl + drainWater) / 2, (spZ0 + spZ1) / 2);
    sheet.renderOrder = 11;
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
  const fnt = p.fountain;
  const nearFountain = (x, z, m) => fnt.enabled && Math.hypot(x - fnt.x, z - fnt.z) < fnt.size / 2 + m;
  for (const b of beds) {
    for (let c = 0; c < p.planting.reedsPerBed; c++) {
      let cx, cz, tries = 0;
      do {
        cx = b.x0 + 0.25 + rnd() * (b.x1 - b.x0 - 0.5);
        cz = b.z0 + 0.25 + rnd() * (b.z1 - b.z0 - 0.5);
      } while ((nearFountain(cx, cz, 0.35) || !pointInPoly({ x: cx, z: cz }, b.poly)) && ++tries < 20);
      if (tries >= 20) continue;
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

  // ---- rock fountain (in the far-end planted strip) ----
  if (fnt.enabled) {
    const R = fnt.size / 2, H = fnt.height;
    const stoneGeo = new THREE.DodecahedronGeometry(1, 0);
    const rock = (x, y, z, sx, sy, sz) => {
      const st = add(mesh(stoneGeo, pick(rnd, mat.stone)));
      st.scale.set(sx, sy, sz);
      st.position.set(x, y, z);
      st.rotation.set((rnd() - 0.5) * 0.4, rnd() * Math.PI, (rnd() - 0.5) * 0.4);
    };
    for (let i = 0; i < 6; i++) { // base ring, sitting in the bed
      const a = (i / 6) * Math.PI * 2 + rnd() * 0.4, s0 = R * (0.38 + rnd() * 0.12);
      rock(fnt.x + Math.cos(a) * R * 0.55, bedTop + s0 * 0.35, fnt.z + Math.sin(a) * R * 0.55, s0, s0 * 0.75, s0);
    }
    const midY = wl + H * 0.3;
    for (let i = 0; i < 3; i++) { // middle tier
      const a = (i / 3) * Math.PI * 2 + 0.5, s1 = R * 0.34;
      rock(fnt.x + Math.cos(a) * R * 0.25, midY, fnt.z + Math.sin(a) * R * 0.25, s1, s1 * 0.9, s1);
    }
    const topY = wl + H * 0.75, s2 = R * 0.32;
    rock(fnt.x, topY, fnt.z, s2 * 1.1, s2 * 0.5, s2);
    // Bubbling water on top, trickles down the rocks, ripples on the pool
    const crest = topY + s2 * 0.45;
    const bub = add(mesh(new THREE.SphereGeometry(0.07, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat.cascade, { cast: false }));
    bub.position.set(fnt.x, crest, fnt.z);
    // Trickles curving over the rocks, mostly towards the pool (-z)
    for (const a of [-Math.PI / 2 - 0.5, -Math.PI / 2 + 0.25, -Math.PI / 2 + 1.1]) {
      const pt = (r, y) => new THREE.Vector3(fnt.x + Math.cos(a) * r, y, fnt.z + Math.sin(a) * r);
      const path = new THREE.CatmullRomCurve3([
        pt(0.03, crest), pt(s2 * 0.9, crest - 0.04), pt(R * 0.45, midY + R * 0.2),
        pt(R * 0.62, midY - 0.05), pt(R * 0.8, wl + 0.02),
      ]);
      const tr = add(mesh(new THREE.TubeGeometry(path, 24, 0.014, 6), mat.cascade, { cast: false, receive: false }));
      tr.renderOrder = 11;
    }
    for (const [r0, r1] of [[R * 0.85, R * 0.92], [R * 1.05, R * 1.1]]) {
      const ring = add(mesh(new THREE.RingGeometry(r0, r1, 40), mat.cascade, { cast: false, receive: false }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(fnt.x, wl + 0.004, fnt.z);
      ring.renderOrder = 11;
    }
  }

  // ---- border planting outside the pool ----
  // Grasses and irises near the coping, shrubs further back. Kept off the downhill side
  // (the view), the dock and filter, the path to the dock and the kids' entrance.
  if (p.border.enabled) {
    const grassGeo = new THREE.ConeGeometry(0.04, 1, 4);
    grassGeo.translate(0, 0.5, 0);
    const leafGeo = new THREE.BoxGeometry(0.035, 1, 0.008);
    leafGeo.translate(0, 0.5, 0);
    const bloomGeo = new THREE.SphereGeometry(0.045, 8, 6);
    const shrubGeo = new THREE.IcosahedronGeometry(1, 1);
    const inRect = (x, z, r, m) => x > r.x0 - m && x < r.x1 + m && z > r.z0 - m && z < r.z1 + m;
    const rectDist = (x, z, r) => Math.hypot(Math.max(0, r.x0 - x, x - r.x1), Math.max(0, r.z0 - z, z - r.z1));
    const poolRect = { x0: -hx - t - out, x1: drX1 + out, z0: -hz - t - out, z1: hz + t + out };
    const struct = { x0: Math.min(dock.x0, filt.x0), x1: -hx - t, z0: Math.min(dock.z0, filt.z0), z1: Math.max(dock.z1, filt.z1) };
    const bw = p.border.width;
    let placed = 0;
    for (let tries = 0; tries < p.border.plants * 40 && placed < p.border.plants; tries++) {
      const x = poolRect.x0 - bw - 2.5 + rnd() * (poolRect.x1 - poolRect.x0 + bw + 2.5);
      const z = poolRect.z0 - bw + rnd() * (poolRect.z1 - poolRect.z0 + 2 * bw);
      const dPool = rectDist(x, z, poolRect), dStruct = rectDist(x, z, struct);
      if (!((dPool > 0.15 && dPool < bw) || (dStruct > 0.15 && dStruct < bw * 0.7))) continue;
      if (inRect(x, z, poolRect, 0.15) || inRect(x, z, dock, 0.15) || inRect(x, z, filt, 0.15)) continue;
      if (x > hx + t) continue;                                             // downhill view
      if (x < dock.x0 && z > dock.z0 - 0.2 && z < dock.z1 + 0.2) continue;  // path to the dock
      if (z < -hz - t && Math.abs(x) < 1.1) continue;                        // kids' entrance
      placed++;
      const y = heightAt(x, z) - 0.02;
      const far = Math.min(dPool, dStruct + 0.3);
      const kind = far > bw * 0.45 && rnd() < 0.7 ? 'shrub' : rnd() < 0.6 ? 'grass' : 'iris';
      if (kind === 'shrub') {
        const r = 0.3 + rnd() * 0.3, m = pick(rnd, mat.shrub);
        for (let k = 0; k < 3; k++) {
          const sh = add(mesh(shrubGeo, m));
          const rr = r * (0.6 + rnd() * 0.4);
          sh.scale.set(rr, rr * 0.8, rr);
          sh.position.set(x + (rnd() - 0.5) * r, y + rr * 0.6, z + (rnd() - 0.5) * r);
          sh.rotation.y = rnd() * Math.PI;
        }
      } else if (kind === 'grass') {
        const m = pick(rnd, mat.grass), hgt = 0.5 + rnd() * 0.5;
        for (let k = 0; k < 18; k++) {
          const bx = x + (rnd() - 0.5) * 0.3, bz = z + (rnd() - 0.5) * 0.3;
          const blade = add(mesh(grassGeo, m, { receive: false }));
          blade.scale.set(1, hgt * (0.6 + rnd() * 0.4), 1);
          blade.position.set(bx, y, bz);
          blade.rotation.set((rnd() - 0.5) * 0.9, 0, (rnd() - 0.5) * 0.9);
        }
      } else {
        for (let k = 0; k < 10; k++) {
          const leaf = add(mesh(leafGeo, mat.irisLeaf, { receive: false }));
          const hgt = 0.45 + rnd() * 0.3;
          leaf.scale.set(1, hgt, 1);
          leaf.position.set(x + (rnd() - 0.5) * 0.2, y, z + (rnd() - 0.5) * 0.2);
          leaf.rotation.set((rnd() - 0.5) * 0.4, rnd() * Math.PI, (rnd() - 0.5) * 0.4);
        }
        for (let k = 0; k < 3; k++) {
          add(mesh(bloomGeo, mat.iris)).position.set(x + (rnd() - 0.5) * 0.25, y + 0.65 + rnd() * 0.15, z + (rnd() - 0.5) * 0.25);
        }
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
      label('seat', hx - seatW + 0.2, wl + 0.05, dz1 - 0.5),
      label('spillway', hx - spW / 2, 0.25, (spZ0 + spZ1) / 2),
      label('drain', (drX0 + drX1) / 2, 0.25, dz1 - 0.6),
      ...(fnt.enabled ? [label('rock fountain', fnt.x, wl + fnt.height + 0.4, fnt.z)] : []),
      label('dock', (dock.x0 + dock.x1) / 2, 0.45, (dock.z0 + dock.z1) / 2),
      label('filter', (filt.x0 + filt.x1) / 2, p.filter.height + 0.3, (filt.z0 + filt.z1) / 2),
    );
    for (const tr of p.trees) add(label('tree', tr.x, heightAt(tr.x, tr.z) + 4.5, tr.z));
  }

  scene.add(g);

  // ---- stats ----
  const area = polyArea(inner);
  const deepArea = W * (dz1 - dz0);
  const bedArea = beds.reduce((s, b) => s + polyArea(b.poly), 0);
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
window.pool = { camera, controls, params, scene }; // handy for poking at the scene from the browser console

// ---------- GUI ----------
const gui = new GUI({ title: 'Pool design' });
const rebuild = () => { info = build(params); };
const fp = gui.addFolder('Pool');
fp.add(params.pool, 'width', 3, 10, 0.05).onChange(rebuild);
fp.add(params.pool, 'length', 5, 20, 0.05).onChange(rebuild);
fp.add(params.pool, 'cornerRadius', 0, 3, 0.05).name('corner radius').onChange(rebuild);
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
fb.add(params.plantBeds, 'cornerRadius', 0, 1.5, 0.05).name('corner radius').onChange(rebuild);
fb.add(params.plantBeds, 'topDepth', 0.05, 0.6, 0.01).name('top depth').onChange(rebuild);
fb.add(params.planting, 'reedsPerBed', 0, 15, 1).name('reed clumps').onChange(rebuild);
fb.add(params.planting, 'lilyPads', 0, 60, 1).name('lily pads').onChange(rebuild);
const ff = gui.addFolder('Spillway, dock, filter');
ff.add(params.spillway, 'centre', -6, 6, 0.05).name('spillway centre').onChange(rebuild);
ff.add(params.spillway, 'length', 0.5, 10, 0.05).name('spillway length').onChange(rebuild);
ff.add(params.spillway, 'width', 0.1, 1.0, 0.05).name('spillway width').onChange(rebuild);
ff.add(params.seat, 'width', 0.3, 1.5, 0.05).name('seat width').onChange(rebuild);
ff.add(params.seat, 'depth', 0.2, 1.2, 0.05).name('seat depth').onChange(rebuild);
ff.add(params.drain, 'width', 0.15, 1.2, 0.05).name('drain width').onChange(rebuild);
ff.add(params.drain, 'depth', 0.1, 0.8, 0.05).name('drain depth').onChange(rebuild);
ff.add(params.dock, 'centre', -6, 6, 0.05).name('dock centre').onChange(rebuild);
ff.add(params.dock, 'length', 1, 8, 0.05).name('dock length').onChange(rebuild);
ff.add(params.dock, 'depth', 0.5, 5, 0.05).name('dock depth').onChange(rebuild);
ff.add(params.filter, 'centre', -6, 6, 0.05).name('filter centre').onChange(rebuild);
const fs = gui.addFolder('Site');
fs.add(params.site, 'slope', 0, 0.4, 0.01).onChange(rebuild);
fs.add(params.border, 'enabled').name('border planting').onChange(rebuild);
fs.add(params.border, 'width', 0.5, 4, 0.1).name('border width').onChange(rebuild);
fs.add(params.border, 'plants', 0, 150, 1).name('border plants').onChange(rebuild);
fs.add(params.fountain, 'enabled').name('rock fountain').onChange(rebuild);
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
