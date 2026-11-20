import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
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

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfd9ea);
scene.fog = new THREE.Fog(0xbfd9ea, 45, 110);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.05, 300);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.495;

scene.add(new THREE.HemisphereLight(0xdfefff, 0x5a6b3a, 0.9));
const sun = new THREE.DirectionalLight(0xfff3dd, 2.2);
sun.position.set(-12, 20, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 70 });
sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);

// ---------- materials ----------
const mat = {
  lawn: new THREE.MeshStandardMaterial({ color: 0x6f9a45, roughness: 1 }),
  bank: new THREE.MeshStandardMaterial({ color: 0x6b5a45, roughness: 1, side: THREE.DoubleSide }),
  gravel: new THREE.MeshStandardMaterial({ color: 0xa08d6a, roughness: 1 }),
  swimFloor: new THREE.MeshStandardMaterial({ color: 0x3e4a48, roughness: 0.9 }),
  swimWall: new THREE.MeshStandardMaterial({ color: 0x55605d, roughness: 0.85 }),
  water: new THREE.MeshPhysicalMaterial({
    color: 0x2c6e70, transparent: true, opacity: 0.55, roughness: 0.06,
    metalness: 0, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide,
  }),
  deck: [0x9c6b43, 0xa47249, 0x93633d].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 })),
  deckFrame: new THREE.MeshStandardMaterial({ color: 0x3d2f22, roughness: 1 }),
  steel: new THREE.MeshStandardMaterial({ color: 0xc9ced1, metalness: 0.9, roughness: 0.25 }),
  stone: [0x8c8a85, 0x7a7670, 0x9a958c].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, flatShading: true })),
  reed: [0x5f8a3a, 0x6f9840, 0x557c33].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 })),
  cattail: new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 1 }),
  lily: new THREE.MeshStandardMaterial({ color: 0x3f7d36, roughness: 0.6, side: THREE.DoubleSide }),
  flower: new THREE.MeshStandardMaterial({ color: 0xf2a6c2, roughness: 0.7 }),
  flowerCentre: new THREE.MeshStandardMaterial({ color: 0xf5d142, roughness: 0.7 }),
  grass: [0x7fa04a, 0x92a85a, 0x6c8f3d].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 1, flatShading: true })),
  trunk: new THREE.MeshStandardMaterial({ color: 0x5b4432, roughness: 1 }),
  foliage: [0x4c7a35, 0x5a8a3c, 0x3f6b2f].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 1, flatShading: true })),
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

// Horizontal shape geometry from (x, z) points, placed at height y.
function flatShape(outer, holes, y) {
  const shape = new THREE.Shape(outer.map(p => new THREE.Vector2(p.x, -p.z)));
  for (const h of holes) shape.holes.push(new THREE.Path(h.map(p => new THREE.Vector2(p.x, -p.z))));
  const g = new THREE.ShapeGeometry(shape, 1);
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}

// Vertical strip following a closed path of (x, z) points, from yTop down to yBottom.
function wallStrip(points, yTop, yBottom) {
  const pos = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    pos.push(a.x, yTop, a.z, b.x, yTop, b.z, a.x, yBottom, a.z);
    pos.push(b.x, yTop, b.z, b.x, yBottom, b.z, a.x, yBottom, a.z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

function pointInPolygon(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.z > p.z) !== (b.z > p.z) && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

function distToPolygon(p, poly) {
  let d = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const dx = b.x - a.x, dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz)));
    d = Math.min(d, Math.hypot(p.x - (a.x + t * dx), p.z - (a.z + t * dz)));
  }
  return d;
}

function polygonArea(poly) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    s += a.x * b.z - b.x * a.z;
  }
  return Math.abs(s) / 2;
}

const mesh = (geo, material, { cast = true, receive = true } = {}) => {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = cast; m.receiveShadow = receive;
  return m;
};

// ---------- pond outline ----------
// Straight edge at the deck end, organic curve around the regeneration zone.
function buildOutline(p) {
  const { length: L, width: W, wallThickness: t } = p.swim;
  const R = Math.max(0.8, p.regen.endLength);
  const S = Math.max(0.8, p.regen.sideWidth);
  const rnd = mulberry32(p.planting.seed + 101);
  const out = () => rnd() * p.regen.wobble; // only pushes outward, so zones never get narrower than set
  const x0 = -t - 0.25;
  const hw = W / 2 + t;
  const ctrl = [
    [x0, -(hw + S * 0.55)], [x0, -hw / 2], [x0, 0], [x0, hw / 2], [x0, hw + S * 0.55],
    [L * 0.25, hw + S + out()], [L * 0.6, hw + S + 0.1 + out()], [L + R * 0.45, hw + S * 0.9 + out()],
    [L + R + out(), hw * 0.4], [L + R + 0.1 + out(), -hw * 0.4],
    [L + R * 0.5, -(hw + S * 0.9 + out())], [L * 0.55, -(hw + S + 0.1 + out())], [L * 0.2, -(hw + S + out())],
  ].map(([x, z]) => new THREE.Vector3(x, 0, z));
  const curve = new THREE.CatmullRomCurve3(ctrl, true, 'centripetal');
  return curve.getSpacedPoints(260).slice(0, -1).map(v => ({ x: v.x, z: v.z }));
}

// ---------- scene construction ----------
let poolGroup = null;

function build(p) {
  if (poolGroup) {
    scene.remove(poolGroup);
    poolGroup.traverse(o => o.geometry && o.geometry.dispose());
  }
  const g = new THREE.Group();
  g.name = 'NaturalPool';
  poolGroup = g;

  const { length: L, width: W, depth: D, wallThickness: t, wallTopDepth } = p.swim;
  const rDepth = Math.min(p.regen.depth, D - 0.1);
  const wl = p.waterLevel;
  const outline = buildOutline(p);
  const rnd = mulberry32(p.planting.seed);

  // Bounding box / centre of the whole pond
  const xs = outline.map(q => q.x), zs = outline.map(q => q.z);
  const bb = { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
  const centre = new THREE.Vector3((bb.minX + bb.maxX) / 2, 0, (bb.minZ + bb.maxZ) / 2);
  const span = Math.max(bb.maxX - bb.minX, bb.maxZ - bb.minZ);

  // Swim zone outer footprint (including walls)
  const swimOuter = [
    { x: -t, z: -W / 2 - t }, { x: L + t, z: -W / 2 - t }, { x: L + t, z: W / 2 + t }, { x: -t, z: W / 2 + t },
  ];
  const inSwimZone = (q, pad = 0) => q.x > -t - pad && q.x < L + t + pad && Math.abs(q.z) < W / 2 + t + pad;

  // Lawn with the pond cut out
  const G = 70;
  const groundRect = [
    { x: centre.x - G, z: centre.z - G }, { x: centre.x + G, z: centre.z - G },
    { x: centre.x + G, z: centre.z + G }, { x: centre.x - G, z: centre.z + G },
  ];
  g.add(mesh(flatShape(groundRect, [outline], 0), mat.lawn, { cast: false }));

  // Regeneration zone: banks and gravel floor
  g.add(mesh(wallStrip(outline, 0, -rDepth), mat.bank, { cast: false }));
  g.add(mesh(flatShape(outline, [swimOuter], -rDepth), mat.gravel, { cast: false }));

  // Swim zone: floor and walls
  const floor = mesh(new THREE.PlaneGeometry(L, W), mat.swimFloor, { cast: false });
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(L / 2, -D, 0);
  g.add(floor);

  const wallTop = -wallTopDepth;
  const wallH = D - wallTopDepth;
  const addBox = (sx, sy, sz, x, y, z, m) => {
    const b = mesh(new THREE.BoxGeometry(sx, sy, sz), m);
    b.position.set(x, y, z);
    g.add(b);
    return b;
  };
  // Long side walls and far end wall are submerged so water flows over from the regeneration zone
  addBox(L + 2 * t, wallH, t, L / 2, -D + wallH / 2, W / 2 + t / 2, mat.swimWall);
  addBox(L + 2 * t, wallH, t, L / 2, -D + wallH / 2, -W / 2 - t / 2, mat.swimWall);
  addBox(t, wallH, W, L + t / 2, -D + wallH / 2, 0, mat.swimWall);
  // Deck-end wall rises to ground level
  addBox(t, D, W + 2 * t, -t / 2, -D / 2, 0, mat.swimWall);
  // Gravel infill between the swim walls and the regen floor
  g.add(mesh(wallStrip(swimOuter, -rDepth, -D), mat.bank, { cast: false }));

  // Water surface
  const water = mesh(flatShape(outline, [], wl), mat.water, { cast: false, receive: false });
  water.renderOrder = 10;
  g.add(water);

  // Deck
  if (p.deck.enabled) {
    const dw = W + 2 * p.deck.extraWidth;
    const deckTop = 0.15;
    const boardW = 0.14, gap = 0.008;
    const x1 = -p.deck.depth, x2 = 0.06;
    for (let x = x1; x + boardW <= x2 + 1e-6; x += boardW + gap) {
      addBox(boardW, 0.03, dw, x + boardW / 2, deckTop - 0.015, 0, pick(rnd, mat.deck));
    }
    addBox(x2 - x1, deckTop - 0.03, dw - 0.1, (x1 + x2) / 2 - 0.05, (deckTop - 0.03) / 2, 0, mat.deckFrame);
  }

  // Ladder into the swim zone from the deck end
  {
    const top = p.deck.enabled ? 0.15 : 0;
    const lz = W / 2 - 0.9;
    const rx = 0.2;
    for (const dz of [-0.25, 0.25]) {
      const path = new THREE.CatmullRomCurve3([
        new THREE.Vector3(rx, -1.3, lz + dz), new THREE.Vector3(rx, top + 0.55, lz + dz),
        new THREE.Vector3(rx - 0.12, top + 0.82, lz + dz), new THREE.Vector3(-0.3, top + 0.82, lz + dz),
        new THREE.Vector3(-0.42, top + 0.6, lz + dz), new THREE.Vector3(-0.42, top, lz + dz),
      ], false, 'centripetal', 0.3);
      g.add(mesh(new THREE.TubeGeometry(path, 60, 0.022, 10), mat.steel));
    }
    for (let y = -1.1; y < -0.05; y += 0.3) addBox(0.09, 0.025, 0.5, rx + 0.02, y, lz, mat.steel);
  }

  // Valid planting spot in the regeneration zone
  const regenSpot = (pad) => {
    for (let i = 0; i < 400; i++) {
      const q = { x: bb.minX + rnd() * (bb.maxX - bb.minX), z: bb.minZ + rnd() * (bb.maxZ - bb.minZ) };
      if (q.x < 0.8) continue; // keep clear of the deck end
      if (!pointInPolygon(q, outline) || inSwimZone(q, 0.35)) continue;
      if (distToPolygon(q, outline) < pad) continue;
      return q;
    }
    return null;
  };

  // Reeds (with some bulrush heads)
  const stemGeo = new THREE.CylinderGeometry(0.006, 0.013, 1, 5);
  stemGeo.translate(0, 0.5, 0);
  const headGeo = new THREE.CapsuleGeometry(0.028, 0.16, 3, 8);
  for (let c = 0; c < p.planting.reedClusters; c++) {
    const q = regenSpot(0.35);
    if (!q) break;
    const n = 10 + Math.floor(rnd() * 14);
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 0.4;
      const h = 1.0 + rnd() * 0.9;
      const s = mesh(stemGeo, pick(rnd, mat.reed), { receive: false });
      s.scale.set(1, h, 1);
      s.position.set(q.x + Math.cos(a) * r, -rDepth, q.z + Math.sin(a) * r);
      s.rotation.set((rnd() - 0.5) * 0.25, 0, (rnd() - 0.5) * 0.25);
      g.add(s);
      if (rnd() < 0.35) {
        const head = mesh(headGeo, mat.cattail, { receive: false });
        head.position.set(0, 0.85, 0);
        head.scale.set(1, 1 / h, 1);
        s.add(head);
      }
    }
  }

  // Water lilies
  const lilyGeo = new THREE.CircleGeometry(1, 24, 0.25, Math.PI * 2 - 0.5);
  lilyGeo.rotateX(-Math.PI / 2);
  const petalGeo = new THREE.SphereGeometry(0.07, 10, 6);
  const centreGeo = new THREE.SphereGeometry(0.025, 8, 6);
  for (let i = 0; i < p.planting.lilyPads; i++) {
    const q = regenSpot(0.25);
    if (!q) break;
    const r = 0.12 + rnd() * 0.12;
    const pad = mesh(lilyGeo, mat.lily, { cast: false });
    pad.scale.setScalar(r);
    pad.position.set(q.x, wl + 0.008, q.z);
    pad.rotation.y = rnd() * Math.PI * 2;
    g.add(pad);
    if (rnd() < 0.3) {
      const f = mesh(petalGeo, mat.flower);
      f.scale.set(1, 0.5, 1);
      f.position.set(q.x, wl + 0.04, q.z);
      const fc = mesh(centreGeo, mat.flowerCentre);
      fc.position.set(q.x, wl + 0.07, q.z);
      g.add(f, fc);
    }
  }

  // Edge stones and grasses around the bank (not on the deck side)
  const outward = (i) => {
    const a = outline[(i - 1 + outline.length) % outline.length], b = outline[(i + 1) % outline.length];
    let nx = b.z - a.z, nz = -(b.x - a.x);
    const len = Math.hypot(nx, nz) || 1;
    nx /= len; nz /= len;
    const q = outline[i];
    if (pointInPolygon({ x: q.x + nx * 0.05, z: q.z + nz * 0.05 }, outline)) { nx = -nx; nz = -nz; }
    return { nx, nz };
  };
  const stoneGeo = new THREE.DodecahedronGeometry(1, 0);
  const grassGeo = new THREE.ConeGeometry(0.04, 1, 4);
  grassGeo.translate(0, 0.5, 0);
  const deckClear = (q) => !p.deck.enabled || q.x > 0.5 || Math.abs(q.z) > W / 2 + p.deck.extraWidth + 0.3;
  for (let i = 0; i < outline.length; i += 3) {
    const q = outline[i];
    if (!deckClear(q)) continue;
    const { nx, nz } = outward(i);
    if (p.planting.edgeStones && rnd() < 0.8) {
      const s = 0.18 + rnd() * 0.25;
      const st = mesh(stoneGeo, pick(rnd, mat.stone));
      st.scale.set(s * (1 + rnd() * 0.5), s * 0.55, s * (1 + rnd() * 0.5));
      st.position.set(q.x + nx * s * 0.6, s * 0.15, q.z + nz * s * 0.6);
      st.rotation.set(rnd() * 0.4, rnd() * Math.PI, rnd() * 0.4);
      g.add(st);
    }
    if (p.planting.edgeGrasses && rnd() < 0.3) {
      const off = 0.6 + rnd() * 0.8;
      const gx = q.x + nx * off, gz = q.z + nz * off;
      const m = pick(rnd, mat.grass);
      for (let k = 0; k < 14; k++) {
        const blade = mesh(grassGeo, m, { receive: false });
        blade.scale.set(1, 0.35 + rnd() * 0.45, 1);
        blade.position.set(gx + (rnd() - 0.5) * 0.25, 0, gz + (rnd() - 0.5) * 0.25);
        blade.rotation.set((rnd() - 0.5) * 0.9, 0, (rnd() - 0.5) * 0.9);
        g.add(blade);
      }
    }
  }

  // Trees around the garden
  const trunkGeo = new THREE.CylinderGeometry(0.12, 0.18, 1, 8);
  trunkGeo.translate(0, 0.5, 0);
  const crownGeo = new THREE.IcosahedronGeometry(1, 1);
  for (let i = 0; i < p.planting.trees; i++) {
    const a = (i / Math.max(1, p.planting.trees)) * Math.PI * 2 + 0.6 + rnd() * 0.8;
    const r = span / 2 + 3 + rnd() * 4;
    const x = centre.x + Math.cos(a) * r, z = centre.z + Math.sin(a) * r;
    if (p.deck.enabled && x < 0 && x > -p.deck.depth - 2 && Math.abs(z) < W / 2 + p.deck.extraWidth + 2) continue;
    // Keep the default camera's line of sight clear (camera sits towards -x, +z; see frame())
    if ((Math.cos(a) * -0.5 + Math.sin(a) * 0.87) > 0.4) continue;
    const h = 2 + rnd() * 1.5;
    const trunk = mesh(trunkGeo, mat.trunk);
    trunk.scale.set(1, h, 1);
    trunk.position.set(x, 0, z);
    const cr = 1.3 + rnd() * 0.9;
    const crown = mesh(crownGeo, pick(rnd, mat.foliage));
    crown.scale.set(cr, cr * 1.1, cr);
    crown.position.set(x, h + cr * 0.7, z);
    g.add(trunk, crown);
  }

  scene.add(g);
  sun.target.position.copy(centre);
  sun.position.set(centre.x - 12, 20, centre.z + 10);

  // ---- stats ----
  const swimArea = L * W;
  const totalArea = polygonArea(outline);
  const regenArea = totalArea - (L + 2 * t) * (W + 2 * t);
  const volume = swimArea * (D + wl) + regenArea * (rDepth + wl);
  const ratio = regenArea / swimArea;
  document.getElementById('stats').innerHTML = `
    <b>Swim zone</b> ${L.toFixed(1)} × ${W.toFixed(1)} m, ${(D + wl).toFixed(2)} m water depth<br>
    <b>Swim area</b> ${swimArea.toFixed(1)} m² &nbsp; <b>Regen area</b> ${regenArea.toFixed(1)} m²<br>
    <b>Total water surface</b> ${totalArea.toFixed(1)} m²<br>
    <b>Approx. water volume</b> ${volume.toFixed(1)} m³ (${Math.round(volume * 1000).toLocaleString('en-GB')} L)<br>
    <b>Regen : swim ratio</b> <span class="${ratio < 1 ? 'warn' : ''}">${ratio.toFixed(2)} : 1</span>
    <div class="hint">Unfiltered, fully planted systems usually aim for a regeneration zone at least as large as the swim zone.</div>`;

  return { centre, span };
}

// ---------- camera framing ----------
function frame({ centre, span }) {
  controls.target.copy(centre).add(new THREE.Vector3(0, -0.3, 0));
  camera.position.set(centre.x - span * 0.55, span * 0.6, centre.z + span * 0.95);
  controls.update();
}

let info = build(params);
frame(info);

// ---------- GUI ----------
const gui = new GUI({ title: 'Pool design' });
const rebuild = () => { info = build(params); };
const fs = gui.addFolder('Swim zone');
fs.add(params.swim, 'length', 3, 25, 0.1).onChange(rebuild);
fs.add(params.swim, 'width', 2, 10, 0.1).onChange(rebuild);
fs.add(params.swim, 'depth', 1, 3, 0.05).onChange(rebuild);
fs.add(params.swim, 'wallThickness', 0.1, 0.5, 0.01).onChange(rebuild);
fs.add(params.swim, 'wallTopDepth', 0.1, 0.6, 0.01).name('submerged wall depth').onChange(rebuild);
const fr = gui.addFolder('Regeneration zone');
fr.add(params.regen, 'endLength', 0.8, 15, 0.1).name('end length').onChange(rebuild);
fr.add(params.regen, 'sideWidth', 0.8, 6, 0.1).name('side width').onChange(rebuild);
fr.add(params.regen, 'depth', 0.2, 1, 0.05).onChange(rebuild);
fr.add(params.regen, 'wobble', 0, 2, 0.05).onChange(rebuild);
gui.add(params, 'waterLevel', -0.3, 0, 0.01).name('water level').onChange(rebuild);
const fd = gui.addFolder('Deck');
fd.add(params.deck, 'enabled').onChange(rebuild);
fd.add(params.deck, 'depth', 0.5, 6, 0.1).onChange(rebuild);
fd.add(params.deck, 'extraWidth', 0, 4, 0.1).name('extra width').onChange(rebuild);
const fp = gui.addFolder('Planting');
fp.add(params.planting, 'reedClusters', 0, 60, 1).name('reed clusters').onChange(rebuild);
fp.add(params.planting, 'lilyPads', 0, 120, 1).name('lily pads').onChange(rebuild);
fp.add(params.planting, 'edgeStones').name('edge stones').onChange(rebuild);
fp.add(params.planting, 'edgeGrasses').name('edge grasses').onChange(rebuild);
fp.add(params.planting, 'trees', 0, 12, 1).onChange(rebuild);
fp.add(params.planting, 'seed', 1, 999, 1).onChange(rebuild);

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
});
renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});
