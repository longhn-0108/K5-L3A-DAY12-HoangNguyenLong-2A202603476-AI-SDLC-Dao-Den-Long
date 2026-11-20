import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { GameEngine } from '../sim/engine.js';
import { getMapConfig } from '../sim/maps.js';
import { DT, TUNING, distXZ } from '../sim/tuning.js';
import { SoundFX } from './audio.js';

// Standardized Color Palette (TICKET-02)
const COLORS = {
  sky: 0x0e1430,
  fog: 0x1b2350,
  grass: 0x2f5d50,
  sand: 0xc9b48a,
  wood: 0x6b4a2f,
  cloudSea: 0x12384a,
  lanternLit: 0xffb347,
  lanternCore: 0xffe9b0,
  lanternUnlit: 0x5b5f6e,
  moteCore: 0xfff6c2,
  moteHalo: 0xffe58a,
  shadeBody: 0x120a1a,
  shadeRim: 0x7a3cff,
  shadeStun: 0x3a3450,
  mayTunic: 0xe8e2d0,
  mayScarf: 0xc8102e,
  gold: 0xf2c14e,
  drifter: 0x8fa3b8,
};

// DOM elements
const canvas = document.getElementById('game-canvas');
const hudEl = document.getElementById('hud');
const hudFlames = document.getElementById('hud-flames');
const hudCharm = document.getElementById('hud-charm');
const hudCharmVal = document.getElementById('hud-charm-val');
const hudNightLabel = document.getElementById('hud-night-label');
const hudTime = document.getElementById('hud-time');
const hudWind = document.getElementById('hud-wind');
const hudLanterns = document.getElementById('hud-lanterns');
const hudScore = document.getElementById('hud-score');
const hudPrompt = document.getElementById('hud-prompt');
const moteCapLabel = document.getElementById('mote-cap-label');
const moteBarEl = document.getElementById('mote-bar');
const cdDashEl = document.getElementById('cd-dash');
const cdDashVal = document.getElementById('cd-dash-val');
const cdPulseEl = document.getElementById('cd-pulse');
const cdPulseVal = document.getElementById('cd-pulse-val');
const lanternArrowEl = document.getElementById('lantern-arrow');

const btnMute = document.getElementById('btn-mute');
const btnPause = document.getElementById('btn-pause');

const overlayEl = document.getElementById('overlay');
const overlayEyebrow = document.getElementById('overlay-eyebrow');
const overlayTitle = document.getElementById('overlay-title');
const overlayDesc = document.getElementById('overlay-desc');
const overlayStats = document.getElementById('overlay-stats');
const menuControls = document.getElementById('menu-controls');
const btnPrimary = document.getElementById('btn-primary');
const btnSecondary = document.getElementById('btn-secondary');
const btnOpenSettings = document.getElementById('btn-open-settings');

const pauseModal = document.getElementById('pause-modal');
const btnResume = document.getElementById('btn-resume');
const btnRestartNight = document.getElementById('btn-restart-night');
const btnPauseSettings = document.getElementById('btn-pause-settings');
const btnPauseMenu = document.getElementById('btn-pause-menu');

const settingsModal = document.getElementById('settings-modal');
const optVolume = document.getElementById('opt-volume');
const optVolumeVal = document.getElementById('opt-volume-val');
const optSens = document.getElementById('opt-sens');
const optSensVal = document.getElementById('opt-sens-val');
const optColorblind = document.getElementById('opt-colorblind');
const btnCloseSettings = document.getElementById('btn-close-settings');

// Build dynamic firefly bar (up to 20 slots)
const moteSlots = [];
for (let i = 0; i < TUNING.capacity_max; i++) {
  const slot = document.createElement('div');
  slot.className = 'mote-slot';
  if (i >= TUNING.carry_capacity) slot.classList.add('hidden');
  moteBarEl.appendChild(slot);
  moteSlots.push(slot);
}

// Persistent settings
const SETTINGS_KEY = 'dao_den_long_settings_v1';
const settings = { volume: 0.7, sensitivity: 1.0, colorblind: false };
try {
  const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  if (typeof saved.volume === 'number') settings.volume = saved.volume;
  if (typeof saved.sensitivity === 'number') settings.sensitivity = saved.sensitivity;
  if (typeof saved.colorblind === 'boolean') settings.colorblind = saved.colorblind;
} catch {}

const sfx = new SoundFX();
sfx.setVolume(settings.volume);
optVolume.value = String(Math.round(settings.volume * 100));
optVolumeVal.textContent = `${Math.round(settings.volume * 100)}%`;
optSens.value = String(Math.round(settings.sensitivity * 100));
optSensVal.textContent = `${settings.sensitivity.toFixed(1)}×`;
optColorblind.checked = settings.colorblind;
document.body.classList.toggle('colorblind', settings.colorblind);

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
}

optColorblind.addEventListener('change', () => {
  settings.colorblind = optColorblind.checked;
  document.body.classList.toggle('colorblind', settings.colorblind);
  saveSettings();
});

optVolume.addEventListener('input', () => {
  settings.volume = Number(optVolume.value) / 100;
  optVolumeVal.textContent = `${optVolume.value}%`;
  sfx.setVolume(settings.volume);
  saveSettings();
});
optSens.addEventListener('input', () => {
  settings.sensitivity = Number(optSens.value) / 100;
  optSensVal.textContent = `${settings.sensitivity.toFixed(1)}×`;
  saveSettings();
});

// Renderer, Scene, Camera, Bloom
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.sky);
scene.fog = new THREE.FogExp2(COLORS.fog, 0.0068);

const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.5, 320);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.45, 0.5, 0.78);
composer.addPass(bloomPass);

// Lighting: ambient follows exact formula 0.15 + 0.55 * (lit / total)
const ambientLight = new THREE.AmbientLight(0xd8e0ff, 0.15);
scene.add(ambientLight);
const hemiLight = new THREE.HemisphereLight(0x6e86d8, 0x1b2350, 0.55);
scene.add(hemiLight);
const moonLight = new THREE.DirectionalLight(0xc4d6ff, 0.8);
moonLight.position.set(28, 52, 22);
moonLight.castShadow = true;
moonLight.shadow.mapSize.set(1024, 1024);
moonLight.shadow.camera.near = 5;
moonLight.shadow.camera.far = 160;
const dCam = 55;
moonLight.shadow.camera.left = -dCam;
moonLight.shadow.camera.right = dCam;
moonLight.shadow.camera.top = dCam;
moonLight.shadow.camera.bottom = -dCam;
scene.add(moonLight);

// Shared geometries
const SHARED = {
  moteOrb: new THREE.SphereGeometry(0.24, 10, 10),
  moteHalo: new THREE.SphereGeometry(0.46, 8, 8),
  dashPuff: new THREE.SphereGeometry(0.2, 6, 6),
  skyLantern: new THREE.CylinderGeometry(0.18, 0.13, 0.38, 6),
  pulseRing: new THREE.RingGeometry(0.5, 0.92, 40),
  ghostHead: new THREE.SphereGeometry(0.46, 12, 12),
  ghostSkirt: new THREE.ConeGeometry(0.76, 1.35, 10, 1, true),
  ghostEye: new THREE.SphereGeometry(0.09, 8, 8),
  ghostWisp: new THREE.SphereGeometry(0.12, 6, 6),
  ghostRing: new THREE.RingGeometry(0.78, 1.08, 22),
  drifterRibbon: new THREE.BoxGeometry(0.38, 0.1, 1.4),
  charmCard: new THREE.BoxGeometry(0.42, 0.62, 0.08),
};

const worldGroup = new THREE.Group();
scene.add(worldGroup);
const dynamicGroup = new THREE.Group();
scene.add(dynamicGroup);

const swayTrees = [];
const windLeaves = [];
const cloudPuffs = [];
const padRings = [];
let mooredBoat = null;
let templeBell = null;
let rainSystem = null;
const RAIN_COUNT = 220;

function makeVisualRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clearGroup(grp) {
  while (grp.children.length > 0) {
    grp.remove(grp.children[0]);
  }
}

function buildIslandVisuals(night) {
  clearGroup(worldGroup);
  swayTrees.length = 0;
  windLeaves.length = 0;
  cloudPuffs.length = 0;
  padRings.length = 0;
  mooredBoat = null;
  templeBell = null;
  rainSystem = null;

  const rng = makeVisualRng(2026 + night * 97);
  const cfg = getMapConfig(night);

  const grassMat = new THREE.MeshStandardMaterial({ color: COLORS.grass, roughness: 0.9 });
  const sandMat = new THREE.MeshStandardMaterial({ color: COLORS.sand, roughness: 0.92 });
  const woodMat = new THREE.MeshStandardMaterial({ color: COLORS.wood, roughness: 0.88 });
  const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x4f3520, roughness: 0.92 });
  const cloudMat = new THREE.MeshStandardMaterial({ color: COLORS.cloudSea, emissive: 0x091c26, emissiveIntensity: 0.45, roughness: 0.95 });
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x4a5266, roughness: 0.92 });
  const mushCapMat = new THREE.MeshStandardMaterial({ color: 0x7dfce4, emissive: 0x2ee0c0, emissiveIntensity: 1.7, roughness: 0.3 });
  const mushStemMat = new THREE.MeshStandardMaterial({ color: COLORS.mayTunic, roughness: 0.8 });
  const blossomMat = new THREE.MeshStandardMaterial({ color: 0xd482a6, emissive: 0x4d1d36, emissiveIntensity: 0.4, roughness: 0.72 });
  const pineMats = [0x244d42, 0x2f5d50, 0x20453b].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }));

  const rockGeo = new THREE.DodecahedronGeometry(0.6, 0);
  const mushCapGeo = new THREE.ConeGeometry(0.26, 0.22, 7);
  const mushStemGeo = new THREE.CylinderGeometry(0.06, 0.09, 0.34, 6);

  function addPineOrBlossom(x, y, z, scale, isBlossom) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * scale, 0.32 * scale, 1.8 * scale, 6), woodMat);
    trunk.position.y = 0.9 * scale;
    g.add(trunk);
    if (isBlossom) {
      const c1 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.4 * scale, 1), blossomMat);
      c1.position.set(0, 2.4 * scale, 0);
      c1.castShadow = true;
      const c2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.95 * scale, 1), blossomMat);
      c2.position.set(0.75 * scale, 2.1 * scale, 0.35 * scale);
      g.add(c1, c2);
    } else {
      const lm = pineMats[Math.floor(rng() * pineMats.length)];
      for (let tier = 0; tier < 3; tier++) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry((1.4 - tier * 0.3) * scale, (1.6 - tier * 0.18) * scale, 6), lm);
        cone.position.y = (1.85 + tier * 0.92) * scale;
        if (tier === 0) cone.castShadow = true;
        g.add(cone);
      }
    }
    worldGroup.add(g);
    swayTrees.push({ group: g, phase: rng() * Math.PI * 2 });
  }

  // Signature Areca Palm ("Cây Cau") for Night 2 — Đảo Cau
  function addCauPalm(x, y, z, scale) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * scale, 0.22 * scale, 4.6 * scale, 7), woodMat);
    trunk.position.y = 2.3 * scale;
    trunk.castShadow = true;
    g.add(trunk);
    const frondMat = pineMats[1];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.32 * scale, 2.1 * scale, 5), frondMat);
      frond.position.set(Math.cos(a) * 0.85 * scale, 4.55 * scale, Math.sin(a) * 0.85 * scale);
      frond.rotation.z = -Math.cos(a) * 1.15;
      frond.rotation.x = Math.sin(a) * 1.15;
      g.add(frond);
    }
    worldGroup.add(g);
    swayTrees.push({ group: g, phase: rng() * Math.PI * 2 });
  }

  function addPropsInRing(cx, cz, y, minR, maxR, count, avoidList) {
    for (let i = 0; i < count; i++) {
      const r = minR + rng() * (maxR - minR);
      const a = rng() * Math.PI * 2;
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r;
      if (avoidList.some((p) => Math.hypot(x - p[0], z - p[2]) < 4.2)) continue;
      if (i % 2 === 0) {
        const rock = new THREE.Mesh(rockGeo, rockMat);
        const s = 0.65 + rng() * 0.65;
        rock.scale.set(s * 1.2, s * 0.65, s);
        rock.position.set(x, y + 0.2, z);
        rock.rotation.y = rng() * Math.PI;
        worldGroup.add(rock);
      } else {
        for (let m = 0; m < 2; m++) {
          const ms = 0.68 + rng() * 0.4;
          const ox = x + (m === 0 ? 0 : 0.38);
          const oz = z + (m === 0 ? 0 : 0.28);
          const stem = new THREE.Mesh(mushStemGeo, mushStemMat);
          stem.scale.setScalar(ms);
          stem.position.set(ox, y + 0.17 * ms, oz);
          const cap = new THREE.Mesh(mushCapGeo, mushCapMat);
          cap.scale.setScalar(ms);
          cap.position.set(ox, y + 0.4 * ms, oz);
          worldGroup.add(stem, cap);
        }
      }
    }
  }

  // Sea of clouds plane + 3D fluffy bobbing cloud puffs
  const cloudPlane = new THREE.Mesh(new THREE.CircleGeometry(190, 40), cloudMat);
  cloudPlane.rotation.x = -Math.PI / 2;
  cloudPlane.position.y = -11;
  worldGroup.add(cloudPlane);

  const puffGeo = new THREE.DodecahedronGeometry(1, 1);
  const cloudCenterX = night === 2 ? 35 : 0;
  const cloudBaseR = night === 2 ? 68 : night === 3 ? 52 : 47;
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2 + (i % 3) * 0.15;
    const dist = cloudBaseR + (i % 4) * 9;
    const puff = new THREE.Mesh(puffGeo, cloudMat);
    const sx = 7.5 + (i % 4) * 3.5;
    const sy = 2.8 + (i % 3) * 1.2;
    puff.scale.set(sx, sy, sx * 0.85);
    const baseY = -4.2 - (i % 3) * 1.4;
    puff.position.set(cloudCenterX + Math.cos(a) * dist, baseY, Math.sin(a) * dist);
    worldGroup.add(puff);
    cloudPuffs.push({ mesh: puff, baseY, phase: i * 0.55 });
  }

  // Gentle silver-indigo night rain streaks
  const rainPos = new Float32Array(RAIN_COUNT * 6);
  for (let i = 0; i < RAIN_COUNT; i++) {
    const rx = cloudCenterX + (rng() - 0.5) * 110;
    const ry = rng() * 30;
    const rz = (rng() - 0.5) * 95;
    rainPos[i * 6 + 0] = rx;
    rainPos[i * 6 + 1] = ry;
    rainPos[i * 6 + 2] = rz;
    rainPos[i * 6 + 3] = rx - 0.14;
    rainPos[i * 6 + 4] = ry - 1.25;
    rainPos[i * 6 + 5] = rz - 0.1;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  rainSystem = new THREE.LineSegments(
    rainGeo,
    new THREE.LineBasicMaterial({ color: COLORS.drifter, transparent: true, opacity: 0.22 })
  );
  worldGroup.add(rainSystem);

  // Starfield
  const starPos = new Float32Array(320 * 3);
  for (let i = 0; i < 320; i++) {
    const t = (i * 2.39996) % (Math.PI * 2);
    const phi = Math.acos(0.15 + ((i * 0.618033) % 0.85));
    const r = 170;
    starPos[i * 3] = cloudCenterX + r * Math.sin(phi) * Math.cos(t);
    starPos[i * 3 + 1] = r * Math.cos(phi);
    starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(t);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  worldGroup.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: COLORS.moteCore, size: 0.85 })));

  const avoidAll = [...cfg.lanterns.map((l) => l.pos), ...cfg.jumpPads.map((p) => p.pos), [0, 0, 0]];

  if (night === 1) {
    // Đêm 1 — Đảo Bến (R = 40m)
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(40, 35.5, 4.5, 56), grassMat);
    disc.position.y = -2.25;
    disc.receiveShadow = true;
    worldGroup.add(disc);

    // Central plaza + golden compass ring + radial sand-stone paths to L1..L5
    const plaza = new THREE.Mesh(new THREE.CircleGeometry(5.5, 28), sandMat);
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.y = 0.03;
    plaza.receiveShadow = true;
    worldGroup.add(plaza);

    const inlay = new THREE.Mesh(
      new THREE.RingGeometry(3.0, 3.5, 24),
      new THREE.MeshStandardMaterial({ color: COLORS.gold, emissive: 0x452a0c, emissiveIntensity: 0.35 })
    );
    inlay.rotation.x = -Math.PI / 2;
    inlay.position.y = 0.038;
    worldGroup.add(inlay);

    for (const l of cfg.lanterns) {
      const len = Math.hypot(l.pos[0], l.pos[2]) - 4;
      const ang = Math.atan2(l.pos[0], l.pos[2]);
      const spoke = new THREE.Mesh(new THREE.PlaneGeometry(1.9, len), sandMat);
      spoke.rotation.x = -Math.PI / 2;
      spoke.rotation.z = ang;
      spoke.position.set(l.pos[0] * 0.52, 0.024, l.pos[2] * 0.52);
      spoke.receiveShadow = true;
      worldGroup.add(spoke);
    }

    // Wooden pier + mooring posts + dock lantern + bobbing wooden boat
    const pier = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.42, 8.5), woodMat);
    pier.position.set(0, 0.12, 42);
    pier.receiveShadow = true;
    worldGroup.add(pier);

    const postGeo = new THREE.CylinderGeometry(0.18, 0.2, 1.35, 6);
    for (const px of [-2.2, 2.2]) {
      for (const pz of [39.5, 43, 45.8]) {
        const post = new THREE.Mesh(postGeo, darkWoodMat);
        post.position.set(px, 0.65, pz);
        worldGroup.add(post);
      }
    }
    const dockLamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 8, 8),
      new THREE.MeshStandardMaterial({ color: COLORS.lanternCore, emissive: COLORS.lanternLit, emissiveIntensity: 2.5 })
    );
    dockLamp.position.set(2.2, 1.5, 45.8);
    worldGroup.add(dockLamp);

    const boatGroup = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 3.6), woodMat);
    const bow = new THREE.Mesh(new THREE.ConeGeometry(0.95, 1.2, 4), woodMat);
    bow.rotation.x = Math.PI / 2;
    bow.rotation.y = Math.PI / 4;
    bow.position.z = 2.3;
    boatGroup.add(hull, bow);
    boatGroup.position.set(-4.8, -0.4, 44.5);
    boatGroup.rotation.y = 0.25;
    worldGroup.add(boatGroup);
    mooredBoat = boatGroup;

    // Pines & blossom trees + rocks & glowing mushrooms
    for (let i = 0; i < 32; i++) {
      const isOuter = i < 24;
      const r = isOuter ? 30 + rng() * 7.5 : 13 + rng() * 8;
      const a = (i / (isOuter ? 24 : 8)) * Math.PI * 2 + (rng() - 0.5) * 0.25;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (Math.abs(x) < 4.5 && z > 32) continue;
      if (avoidAll.some((p) => Math.hypot(x - p[0], z - p[2]) < 5.0)) continue;
      addPineOrBlossom(x, 0, z, 0.85 + rng() * 0.5, i % 5 === 0);
    }
    addPropsInRing(0, 0, 0, 8, 36, 26, avoidAll);
  } else if (night === 2) {
    // Đêm 2 — Đảo Cau: Island A (0,0,0) & Island B (70,0,0), R=28m, bamboo bridge x=[26,44], z=[-2,2]
    for (const cx of [0, 70]) {
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(28, 24.5, 4.5, 48), grassMat);
      disc.position.set(cx, -2.25, 0);
      disc.receiveShadow = true;
      worldGroup.add(disc);

      const center = new THREE.Mesh(new THREE.CircleGeometry(4.2, 24), sandMat);
      center.rotation.x = -Math.PI / 2;
      center.position.set(cx, 0.03, 0);
      worldGroup.add(center);

      // Areca Palms ("Cây Cau") & blossom trees around each island
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + (rng() - 0.5) * 0.25;
        const r = 14 + rng() * 11;
        const x = cx + Math.cos(a) * r;
        const z = Math.sin(a) * r;
        if (Math.abs(z) < 4 && ((cx === 0 && x > 22) || (cx === 70 && x < 48))) continue;
        if (avoidAll.some((p) => Math.hypot(x - p[0], z - p[2]) < 4.8)) continue;
        if (i % 3 === 0) addPineOrBlossom(x, 0, z, 0.85 + rng() * 0.35, true);
        else addCauPalm(x, 0, z, 0.85 + rng() * 0.45);
      }
      addPropsInRing(cx, 0, 0, 6, 24, 14, avoidAll);
    }

    // Detailed bamboo plank bridge (no railings!) x in [26, 44], z in [-2, 2]
    const bridgeBase = new THREE.Mesh(new THREE.BoxGeometry(18, 0.32, 4), woodMat);
    bridgeBase.position.set(35, -0.16, 0);
    bridgeBase.receiveShadow = true;
    worldGroup.add(bridgeBase);
    const slatGeo = new THREE.BoxGeometry(0.45, 0.12, 3.9);
    for (let bx = 26.5; bx <= 43.5; bx += 0.9) {
      const slat = new THREE.Mesh(slatGeo, bx % 1.8 < 0.9 ? sandMat : darkWoodMat);
      slat.position.set(bx, 0.04, 0);
      worldGroup.add(slat);
    }
  } else {
    // Đêm 3 — Đảo Chuông (R=45m, 3 tiers, 2 ramps, Bell Tower)
    const t0 = new THREE.Mesh(new THREE.CylinderGeometry(45, 40, 4.5, 56), grassMat);
    t0.position.y = -2.25;
    t0.receiveShadow = true;
    worldGroup.add(t0);

    const tier1Shape = new THREE.Shape();
    tier1Shape.absarc(0, 0, 24, 0, Math.PI, false);
    tier1Shape.absarc(0, 0, 12, Math.PI, 0, true);
    const tier1Geo = new THREE.ExtrudeGeometry(tier1Shape, { depth: 3, bevelEnabled: false, curveSegments: 32 });
    tier1Geo.rotateX(Math.PI / 2);
    const tier1 = new THREE.Mesh(tier1Geo, sandMat);
    tier1.position.y = 3;
    tier1.receiveShadow = true;
    worldGroup.add(tier1);

    const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 6, 32), sandMat);
    tier2.position.y = 3;
    tier2.receiveShadow = true;
    worldGroup.add(tier2);

    const tier2Rim = new THREE.Mesh(
      new THREE.RingGeometry(7.6, 8.0, 32),
      new THREE.MeshBasicMaterial({ color: COLORS.gold, side: THREE.DoubleSide })
    );
    tier2Rim.rotation.x = -Math.PI / 2;
    tier2Rim.position.y = 6.03;
    worldGroup.add(tier2Rim);

    // 2 straight 3m ramps at 30° and 150° + warm guide torches at foot of each ramp
    for (const deg of [30, 150]) {
      const rad = (deg * Math.PI) / 180;
      const rampLen = Math.hypot(6, 3);
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(rampLen, 0.35, 3), woodMat);
      ramp.position.set(Math.cos(rad) * 27, 1.5, Math.sin(rad) * 27);
      ramp.rotation.y = -rad;
      ramp.rotation.z = Math.atan2(-3, 6);
      ramp.receiveShadow = true;
      worldGroup.add(ramp);

      const torch = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 8, 8),
        new THREE.MeshStandardMaterial({ color: COLORS.lanternCore, emissive: COLORS.lanternLit, emissiveIntensity: 2.2 })
      );
      torch.position.set(Math.cos(rad) * 30.8, 1.2, Math.sin(rad) * 30.8);
      worldGroup.add(torch);
    }

    // Ornate 8m Bell Tower at center of Tier 2 + hanging golden temple bell
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 8, 16), woodMat);
    tower.position.set(0, 10, 0);
    tower.castShadow = true;
    const bellRoof = new THREE.Mesh(new THREE.ConeGeometry(3.4, 2.4, 8), new THREE.MeshStandardMaterial({ color: COLORS.mayScarf }));
    bellRoof.position.set(0, 15.1, 0);
    const bell = new THREE.Mesh(
      new THREE.ConeGeometry(0.9, 1.4, 12),
      new THREE.MeshStandardMaterial({ color: COLORS.gold, emissive: 0x6b470c, emissiveIntensity: 0.5, metalness: 0.6, roughness: 0.3 })
    );
    bell.position.set(0, 13.0, 0);
    worldGroup.add(tower, bellRoof, bell);
    templeBell = bell;

    // Pines, blossom trees, rocks & mushrooms on outer Tier 0 meadow
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2 + (rng() - 0.5) * 0.2;
      const r = 32 + rng() * 10;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (avoidAll.some((p) => Math.hypot(x - p[0], z - p[2]) < 5.0)) continue;
      addPineOrBlossom(x, 0, z, 0.9 + rng() * 0.5, i % 4 === 0);
    }
    addPropsInRing(0, 0, 0, 26, 42, 24, avoidAll);

    // Wind leaves visual pool
    const leafMat = new THREE.MeshBasicMaterial({ color: COLORS.gold, side: THREE.DoubleSide });
    const leafGeo = new THREE.PlaneGeometry(0.42, 0.22);
    for (let i = 0; i < 45; i++) {
      const m = new THREE.Mesh(leafGeo, leafMat);
      m.visible = false;
      worldGroup.add(m);
      windLeaves.push({ mesh: m, x: (rng() - 0.5) * 76, y: 1 + rng() * 8, z: (rng() - 0.5) * 76 });
    }
  }

  // Glowing Jump Pads with animated rising halo rings
  const padMat = new THREE.MeshStandardMaterial({
    color: COLORS.gold,
    emissive: COLORS.lanternLit,
    emissiveIntensity: 1.8,
  });
  for (const pad of cfg.jumpPads) {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(pad.radius, pad.radius * 1.18, 0.24, 20), padMat);
    disc.position.set(pad.pos[0], pad.pos[1] + 0.12, pad.pos[2]);
    worldGroup.add(disc);

    const halo = new THREE.Mesh(
      new THREE.RingGeometry(pad.radius * 0.85, pad.radius * 1.12, 24),
      new THREE.MeshBasicMaterial({ color: COLORS.moteHalo, transparent: true, opacity: 0.75, side: THREE.DoubleSide })
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.set(pad.pos[0], pad.pos[1] + 0.3, pad.pos[2]);
    worldGroup.add(halo);
    padRings.push({ mesh: halo, baseY: pad.pos[1] + 0.25 });
  }
}

// Ninja Mây with standardized palette (#E8E2D0 tunic, #C8102E scarf, nón lá + hanging lantern)
function buildPlayerMesh() {
  const root = new THREE.Group();
  const footRing = new THREE.Mesh(
    new THREE.RingGeometry(0.65, 0.84, 24),
    new THREE.MeshBasicMaterial({ color: COLORS.gold, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
  );
  footRing.rotation.x = -Math.PI / 2;
  footRing.position.y = 0.05;
  root.add(footRing);

  const rig = new THREE.Group();
  root.add(rig);

  const tunicMat = new THREE.MeshStandardMaterial({ color: COLORS.mayTunic, roughness: 0.65 });
  const scarfMat = new THREE.MeshStandardMaterial({ color: COLORS.mayScarf, roughness: 0.55 });

  const torso = new THREE.Mesh(new THREE.ConeGeometry(0.46, 1.05, 10), tunicMat);
  torso.position.y = 0.72;
  torso.castShadow = true;
  rig.add(torso);

  const legGeo = new THREE.CapsuleGeometry(0.11, 0.34, 4, 6);
  const leftLeg = new THREE.Mesh(legGeo, tunicMat);
  leftLeg.position.set(-0.18, 0.28, 0);
  const rightLeg = new THREE.Mesh(legGeo, tunicMat);
  rightLeg.position.set(0.18, 0.28, 0);
  rig.add(leftLeg, rightLeg);

  const armGeo = new THREE.CapsuleGeometry(0.09, 0.44, 4, 6);
  const leftArm = new THREE.Mesh(armGeo, tunicMat);
  leftArm.position.set(-0.42, 0.92, -0.1);
  const rightArm = new THREE.Mesh(armGeo, tunicMat);
  rightArm.position.set(0.42, 0.92, -0.1);
  rig.add(leftArm, rightArm);

  const scarfSegments = [];
  for (let i = 0; i < 3; i++) {
    const seg = new THREE.Mesh(new THREE.BoxGeometry(0.24 - i * 0.04, 0.07, 0.46), scarfMat);
    seg.position.set(0, 1.18 - i * 0.06, -0.35 - i * 0.38);
    rig.add(seg);
    scarfSegments.push(seg);
  }

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 10), new THREE.MeshStandardMaterial({ color: 0xffe4c7 }));
  head.position.y = 1.42;
  rig.add(head);

  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.86, 0.44, 18), new THREE.MeshStandardMaterial({ color: COLORS.sand }));
  hat.position.y = 1.72;
  hat.castShadow = true;
  rig.add(hat);

  const lanternPivot = new THREE.Group();
  lanternPivot.position.set(0.64, 1.54, 0.16);
  const miniLanternMat = new THREE.MeshStandardMaterial({
    color: COLORS.lanternCore,
    emissive: COLORS.lanternLit,
    emissiveIntensity: 2.2,
  });
  const miniLantern = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), miniLanternMat);
  miniLantern.position.y = -0.28;
  lanternPivot.add(miniLantern);
  rig.add(lanternPivot);

  const playerLight = new THREE.PointLight(COLORS.lanternLit, 4.5, 18, 1.3);
  playerLight.position.set(0, 2.3, 0);
  root.add(playerLight);

  root.userData = { rig, leftLeg, rightLeg, leftArm, rightArm, scarfSegments, lanternPivot, miniLanternMat, playerLight, flipAngle: 0, dashCooldown: 0, smoothYaw: 0 };
  scene.add(root);
  return root;
}

const playerMesh = buildPlayerMesh();

// Dynamic pools
const lanternViews = new Map();
const moteViews = new Map();
const shadeViews = new Map();
const drifterViews = new Map();
const charmViews = new Map();
const skyLanterns = [];
const pulseRings = [];
const dashTrails = [];

const moteOrbMat = new THREE.MeshStandardMaterial({ color: COLORS.moteCore, emissive: COLORS.moteHalo, emissiveIntensity: 2.8 });
const moteHaloMat = new THREE.MeshBasicMaterial({ color: COLORS.moteHalo, transparent: true, opacity: 0.32 });

function createLanternView(l) {
  const g = new THREE.Group();
  g.position.set(l.pos[0], l.pos[1], l.pos[2]);

  const poleMat = new THREE.MeshStandardMaterial({ color: COLORS.wood, roughness: 0.85 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 2.8, 8), poleMat);
  pole.position.y = 1.4;
  g.add(pole);

  const coreMat = new THREE.MeshStandardMaterial({
    color: COLORS.lanternUnlit,
    emissive: COLORS.lanternLit,
    emissiveIntensity: 0.1,
    roughness: 0.3,
  });
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.55, 1.25, 8), coreMat);
  core.position.y = 3.2;
  g.add(core);

  // Paper tear/rip strips visible when lantern is unlit (non-color distinction)
  const ripGroup = new THREE.Group();
  const ripMat = new THREE.MeshBasicMaterial({ color: 0x161221 });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const rip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.72, 0.08), ripMat);
    rip.position.set(Math.cos(a) * 0.62, 3.2, Math.sin(a) * 0.62);
    rip.rotation.y = -a;
    rip.rotation.z = 0.25;
    ripGroup.add(rip);
  }
  g.add(ripGroup);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.1, 0.65, 8), poleMat);
  roof.position.y = 4.1;
  g.add(roof);

  // Floating 3D fuel bar above lit lanterns
  const fuelBarGroup = new THREE.Group();
  fuelBarGroup.position.y = 5.0;
  const fuelBg = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.22, 0.12),
    new THREE.MeshBasicMaterial({ color: 0x16182b })
  );
  const fuelFillMat = new THREE.MeshBasicMaterial({ color: COLORS.lanternLit });
  const fuelFill = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.16, 0.16), fuelFillMat);
  fuelBarGroup.add(fuelBg, fuelFill);
  fuelBarGroup.visible = false;
  g.add(fuelBarGroup);

  const light = new THREE.PointLight(COLORS.lanternLit, 0, 26, 1.25);
  light.position.y = 3.4;
  g.add(light);

  const ringMat = new THREE.MeshBasicMaterial({ color: COLORS.lanternLit, transparent: true, opacity: 0, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(TUNING.safe_radius - 0.16, TUNING.safe_radius, 40), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  g.add(ring);

  g.userData = { core, coreMat, ripGroup, fuelBarGroup, fuelFill, fuelFillMat, light, ringMat };
  dynamicGroup.add(g);
  return g;
}

function createMoteView(m) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(SHARED.moteOrb, moteOrbMat));
  g.add(new THREE.Mesh(SHARED.moteHalo, moteHaloMat));
  g.position.set(m.pos[0], m.pos[1] + 0.85, m.pos[2]);
  dynamicGroup.add(g);
  return g;
}

function createShadeView(s) {
  const root = new THREE.Group();
  const rig = new THREE.Group();
  root.add(rig);

  const bodyMat = new THREE.MeshStandardMaterial({
    color: COLORS.shadeBody,
    emissive: COLORS.shadeRim,
    emissiveIntensity: 1.0,
    transparent: true,
    opacity: 0.86,
    side: THREE.DoubleSide,
  });
  const head = new THREE.Mesh(SHARED.ghostHead, bodyMat);
  head.position.y = 0.62;
  const skirt = new THREE.Mesh(SHARED.ghostSkirt, bodyMat);
  skirt.position.y = -0.02;
  rig.add(head, skirt);

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x9ef7ff });
  const lEye = new THREE.Mesh(SHARED.ghostEye, eyeMat);
  lEye.position.set(-0.16, 0.68, 0.38);
  const rEye = new THREE.Mesh(SHARED.ghostEye, eyeMat);
  rEye.position.set(0.16, 0.68, 0.38);
  rig.add(lEye, rEye);

  const ringMat = new THREE.MeshBasicMaterial({ color: COLORS.shadeRim, transparent: true, opacity: 0.42, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(SHARED.ghostRing, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -0.92;
  root.add(ring);

  root.position.set(s.pos[0], s.pos[1], s.pos[2]);
  root.userData = { rig, bodyMat, eyeMat, ringMat };
  dynamicGroup.add(root);
  return root;
}

function createDrifterView(d) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: COLORS.drifter,
    emissive: 0x4b647d,
    emissiveIntensity: 0.8,
    transparent: true,
    opacity: 0.85,
  });
  const seg1 = new THREE.Mesh(SHARED.drifterRibbon, mat);
  const seg2 = new THREE.Mesh(SHARED.drifterRibbon, mat);
  seg2.position.z = -1.2;
  seg2.scale.set(0.8, 0.8, 0.85);
  g.add(seg1, seg2);
  g.position.set(d.pos[0], d.pos[1], d.pos[2]);
  g.userData = { seg2 };
  dynamicGroup.add(g);
  return g;
}

function createCharmView(c) {
  const g = new THREE.Group();
  const card = new THREE.Mesh(
    SHARED.charmCard,
    new THREE.MeshStandardMaterial({ color: COLORS.mayScarf, emissive: COLORS.mayScarf, emissiveIntensity: 0.9 })
  );
  const border = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.68, 0.05),
    new THREE.MeshStandardMaterial({ color: COLORS.gold, emissive: COLORS.gold, emissiveIntensity: 1.2 })
  );
  g.add(border, card);
  g.position.set(c.pos[0], c.pos[1] + 1.0, c.pos[2]);
  dynamicGroup.add(g);
  return g;
}

function spawnSkyLanterns(originPos) {
  for (let i = 0; i < 5; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: COLORS.lanternLit, transparent: true, opacity: 0.95 });
    const mesh = new THREE.Mesh(SHARED.skyLantern, mat);
    mesh.position.set(originPos[0] + (Math.random() - 0.5) * 2.2, originPos[1] + 4, originPos[2] + (Math.random() - 0.5) * 2.2);
    dynamicGroup.add(mesh);
    skyLanterns.push({ mesh, mat, vy: 1.6 + Math.random() * 0.8, dx: (Math.random() - 0.5) * 0.4, dz: (Math.random() - 0.5) * 0.4, age: 0, maxAge: 7 });
  }
}

function spawnPulseRing(originPos) {
  const mat = new THREE.MeshBasicMaterial({ color: COLORS.moteHalo, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(SHARED.pulseRing, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(originPos[0], originPos[1] + 0.14, originPos[2]);
  dynamicGroup.add(mesh);
  pulseRings.push({ mesh, mat, age: 0, duration: 0.4 });
}

function spawnDashPuff(pos) {
  const mat = new THREE.MeshBasicMaterial({ color: COLORS.moteHalo, transparent: true, opacity: 0.5 });
  const mesh = new THREE.Mesh(SHARED.dashPuff, mat);
  mesh.position.set(pos[0], pos[1] + 0.2, pos[2]);
  dynamicGroup.add(mesh);
  dashTrails.push({ mesh, mat, age: 0, maxAge: 0.25 });
}

// Campaign & Session state
let currentNight = 1;
let totalCampaignScore = 0;
let engine = null;
let screenMode = 'menu'; // 'menu' | 'intro' | 'playing' | 'paused' | 'result'
let accumulator = 0;
let lastTime = performance.now();
let visualClock = 0;
let lastCountdownSec = -1;
let prevWindWarning = false;

let prevPlayerPos = [0, 0, 0];
const prevShadePositions = new Map();
const camTargetVec = new THREE.Vector3();

// Input state
const keys = new Set();
let pendingPauseToggle = false;
let camYawDeg = 0;
let camZoom = 1.0;
let dragging = false;
let lastMouseX = 0;

window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'KeyM') {
    btnMute.textContent = sfx.toggleMute() ? '🔇' : '🔊';
  }
  if ((e.code === 'Escape' || e.code === 'KeyP') && (screenMode === 'playing' || screenMode === 'paused')) {
    pendingPauseToggle = true;
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));

canvas.addEventListener('mousedown', (e) => {
  if (e.button === 0) {
    dragging = true;
    lastMouseX = e.clientX;
  }
});
window.addEventListener('mouseup', () => { dragging = false; });
window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastMouseX;
  lastMouseX = e.clientX;
  camYawDeg = (camYawDeg - dx * 0.35 * settings.sensitivity + 360) % 360;
});
canvas.addEventListener('wheel', (e) => {
  camZoom = Math.min(1.5, Math.max(0.7, camZoom + e.deltaY * 0.0006));
}, { passive: true });

btnMute.addEventListener('click', () => { btnMute.textContent = sfx.toggleMute() ? '🔇' : '🔊'; });
btnPause.addEventListener('click', () => { if (screenMode === 'playing' || screenMode === 'paused') pendingPauseToggle = true; });
btnResume.addEventListener('click', () => { if (screenMode === 'paused') pendingPauseToggle = true; });
btnRestartNight.addEventListener('click', () => { pauseModal.classList.add('hidden'); startNight(currentNight); });
btnPauseSettings.addEventListener('click', () => { settingsModal.classList.remove('hidden'); });
btnOpenSettings.addEventListener('click', () => { settingsModal.classList.remove('hidden'); });
btnCloseSettings.addEventListener('click', () => { settingsModal.classList.add('hidden'); });
btnPauseMenu.addEventListener('click', () => { pauseModal.classList.add('hidden'); showMainMenu(); });

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  bloomPass.setSize(window.innerWidth, window.innerHeight);
});

function clearDynamicViews() {
  clearGroup(dynamicGroup);
  lanternViews.clear();
  moteViews.clear();
  shadeViews.clear();
  drifterViews.clear();
  charmViews.clear();
  skyLanterns.length = 0;
  pulseRings.length = 0;
  dashTrails.length = 0;
}

function showMainMenu() {
  screenMode = 'menu';
  currentNight = 1;
  totalCampaignScore = 0;
  hudEl.classList.add('hidden');
  lanternArrowEl.classList.add('hidden');
  overlayEl.classList.remove('hidden');
  overlayStats.classList.add('hidden');
  menuControls.classList.remove('hidden');
  btnSecondary.classList.add('hidden');
  overlayEyebrow.textContent = 'Hành Trình Ba Hòn Đảo';
  overlayTitle.textContent = 'Đảo Đèn Lồng';
  overlayDesc.innerHTML = 'Giúp <strong>Mây</strong> thu thập đom đóm, thắp sáng các Đèn Lồng Lớn qua <strong>3 Đêm</strong> (Đảo Bến, Đảo Cau, Đảo Chuông) để đón Bình Minh trở lại.';
  btnPrimary.textContent = 'Bắt đầu Đêm 1';
  btnPrimary.onclick = () => showNightIntro(1);
  buildIslandVisuals(1);
}

function showNightIntro(night) {
  currentNight = night;
  screenMode = 'intro';
  const cfg = getMapConfig(night);
  buildIslandVisuals(night);
  hudEl.classList.add('hidden');
  lanternArrowEl.classList.add('hidden');
  overlayEl.classList.remove('hidden');
  overlayStats.classList.add('hidden');
  menuControls.classList.add('hidden');
  btnSecondary.classList.remove('hidden');
  btnSecondary.textContent = 'Về Menu';
  btnSecondary.onclick = showMainMenu;

  overlayEyebrow.textContent = `Đêm ${night} / 3`;
  overlayTitle.textContent = cfg.name;
  overlayDesc.textContent = cfg.quote;
  btnPrimary.textContent = `Vào ${cfg.name}`;
  btnPrimary.onclick = () => startNight(night);
}

function startNight(night) {
  sfx.startAmbient();
  clearDynamicViews();
  buildIslandVisuals(night);

  const seed = Math.floor(Math.random() * 100000) + 1;
  engine = new GameEngine({ seed, night });
  camYawDeg = 0;
  camZoom = 1.0;
  accumulator = 0;
  lastCountdownSec = -1;
  prevWindWarning = false;
  screenMode = 'playing';

  for (const l of engine.lanterns) lanternViews.set(l.id, createLanternView(l));
  for (const c of engine.charms) charmViews.set(c.id, createCharmView(c));
  capturePrevState();

  overlayEl.classList.add('hidden');
  pauseModal.classList.add('hidden');
  hudEl.classList.remove('hidden');
  hudNightLabel.textContent = engine.map.name;
  syncViews(0, 1);
  updateHUD();
}

function showNightResult(result, reason) {
  screenMode = 'result';
  overlayEl.classList.remove('hidden');
  overlayStats.classList.remove('hidden');
  menuControls.classList.add('hidden');
  lanternArrowEl.classList.add('hidden');
  btnSecondary.classList.remove('hidden');
  btnSecondary.textContent = 'Về Menu';
  btnSecondary.onclick = showMainMenu;

  const litCount = engine.lanterns.filter((l) => l.lit).length;
  if (result === 'won') {
    totalCampaignScore += engine.score;
    sfx.playWin();
    if (currentNight < 3) {
      overlayEyebrow.textContent = `Hoàn thành Đêm ${currentNight}`;
      overlayTitle.textContent = `${engine.map.name} Đã Sáng!`;
      overlayDesc.textContent = 'Sương đen đã rút lui. Hãy chuẩn bị bước sang hòn đảo tiếp theo!';
      btnPrimary.textContent = `Sang Đêm ${currentNight + 1}`;
      btnPrimary.onclick = () => showNightIntro(currentNight + 1);
    } else {
      overlayEyebrow.textContent = 'Bình Minh Đã Trở Lại';
      overlayTitle.textContent = 'Chúc Mừng! Phá Đảo Đèn Lồng!';
      overlayDesc.textContent = `Mây đã thắp sáng cả Ba Hòn Đảo. Tổng điểm toàn hành trình: ${totalCampaignScore}.`;
      btnPrimary.textContent = 'Chơi lại từ Đêm 1';
      btnPrimary.onclick = () => { totalCampaignScore = 0; showNightIntro(1); };
    }
  } else {
    sfx.playLose();
    overlayEyebrow.textContent = `Thất bại — Đêm ${currentNight}`;
    overlayTitle.textContent = reason === 'dawn' ? 'Bình Minh Đã Lên...' : 'Ngọn Lửa Đã Tắt...';
    overlayDesc.textContent = reason === 'dawn' ? 'Hết thời gian trước khi thắp hết Đèn Lồng Lớn.' : 'Mây đã mất hết Ngọn Lửa. Hãy thử lại Đêm này nhé!';
    btnPrimary.textContent = `Chơi lại Đêm ${currentNight}`;
    btnPrimary.onclick = () => startNight(currentNight);
  }

  overlayStats.innerHTML = `
    <div class="stat-box"><div class="k">Điểm Đêm ${currentNight}</div><div class="v">${engine.score}</div></div>
    <div class="stat-box"><div class="k">Đèn đã thắp</div><div class="v">${litCount} / ${engine.lanterns.length}</div></div>
    <div class="stat-box"><div class="k">Tổng điểm</div><div class="v">${totalCampaignScore}</div></div>
  `;
}

function capturePrevState() {
  if (!engine) return;
  prevPlayerPos = [...engine.player.pos];
  prevShadePositions.clear();
  for (const s of engine.shades) prevShadePositions.set(s.id, [...s.pos]);
}

function handleEvents(events) {
  for (const ev of events) {
    if (ev.name === 'paused') {
      screenMode = 'paused';
      pauseModal.classList.remove('hidden');
    } else if (ev.name === 'resumed') {
      screenMode = 'playing';
      pauseModal.classList.add('hidden');
    } else if (ev.name === 'mote_picked') {
      sfx.playPickup(ev.data.carried);
    } else if (ev.name === 'charm_picked') {
      sfx.playCharm();
    } else if (ev.name === 'deposit' || ev.name === 'refuel') {
      sfx.playDeposit();
    } else if (ev.name === 'lantern_out') {
      sfx.playHit();
    } else if (ev.name === 'lantern_lit') {
      sfx.playLanternLit();
      const l = engine.lanterns.find((x) => x.id === ev.data.lantern_id);
      if (l) spawnSkyLanterns(l.pos);
    } else if (ev.name === 'pulse') {
      sfx.playPulse();
      spawnPulseRing(engine.player.pos);
    } else if (ev.name === 'dash') {
      sfx.playDash();
      spawnDashPuff(engine.player.pos);
    } else if (ev.name === 'player_hit') {
      sfx.playHit();
    } else if (ev.name === 'shade_spawned') {
      sfx.playShadeSpawn();
    } else if (ev.name === 'game_over') {
      showNightResult(ev.data.result, ev.data.reason);
    }
  }
}

function readLiveInput(dtVisual) {
  const rotSpeed = 125 * dtVisual * settings.sensitivity;
  if (keys.has('ArrowLeft') || keys.has('KeyQ')) camYawDeg = (camYawDeg + rotSpeed) % 360;
  if (keys.has('ArrowRight')) camYawDeg = (camYawDeg - rotSpeed + 360) % 360;

  let mx = 0;
  let mz = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) mz -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) mz += 1;
  if (keys.has('KeyA')) mx -= 1;
  if (keys.has('KeyD')) mx += 1;

  const pauseVal = pendingPauseToggle;
  pendingPauseToggle = false;

  return {
    move: [mx, mz],
    cam_yaw_deg: camYawDeg,
    jump: keys.has('Space'),
    interact: keys.has('KeyE') || keys.has('KeyF'),
    pulse: keys.has('KeyR'),
    dash: keys.has('ShiftLeft') || keys.has('ShiftRight'),
    pause: pauseVal,
  };
}

function lerpAngle(a, b, t) {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

function animateScenery(dtVisual) {
  visualClock += dtVisual;
  for (const t of swayTrees) {
    t.group.rotation.z = Math.sin(visualClock * 1.4 + t.phase) * 0.036;
  }
  for (const c of cloudPuffs) {
    c.mesh.position.y = c.baseY + Math.sin(visualClock * 0.7 + c.phase) * 0.38;
  }
  for (const pr of padRings) {
    const p = (visualClock * 1.1) % 1;
    pr.mesh.position.y = pr.baseY + p * 1.8;
    pr.mesh.scale.setScalar(1 + p * 0.45);
    pr.mesh.material.opacity = (1 - p) * 0.8;
  }
  if (mooredBoat) {
    mooredBoat.position.y = -0.35 + Math.sin(visualClock * 1.8) * 0.14;
    mooredBoat.rotation.z = Math.sin(visualClock * 1.3) * 0.05;
  }
  if (templeBell) {
    templeBell.rotation.z = Math.sin(visualClock * 2.1) * (engine?.wind?.active ? 0.28 : 0.06);
  }
  if (rainSystem && dtVisual > 0) {
    const posAttr = rainSystem.geometry.attributes.position;
    const arr = posAttr.array;
    const fall = 21 * dtVisual;
    for (let i = 0; i < RAIN_COUNT; i++) {
      let y1 = arr[i * 6 + 1] - fall;
      if (y1 < 0) y1 += 30;
      arr[i * 6 + 1] = y1;
      arr[i * 6 + 4] = y1 - 1.25;
    }
    posAttr.needsUpdate = true;
  }
}

function syncViews(dtVisual, alpha) {
  if (!engine) return;
  animateScenery(dtVisual);

  const p = engine.player;
  const ud = playerMesh.userData;
  const px = prevPlayerPos[0] + (p.pos[0] - prevPlayerPos[0]) * alpha;
  const py = prevPlayerPos[1] + (p.pos[1] - prevPlayerPos[1]) * alpha;
  const pz = prevPlayerPos[2] + (p.pos[2] - prevPlayerPos[2]) * alpha;

  const isMoving = Math.hypot(p.vel[0], p.vel[2]) > 0.5;
  const isAirborne = !p.grounded;
  playerMesh.position.set(px, py, pz);
  const damp = 1 - Math.exp(-16 * dtVisual);
  ud.smoothYaw = lerpAngle(ud.smoothYaw, p.facingYaw, dtVisual > 0 ? damp : 1);
  playerMesh.rotation.y = ud.smoothYaw;
  playerMesh.visible = p.respawnWaitTicks === 0 && (p.invulnTicks === 0 || Math.floor(visualClock * 16) % 2 === 0);

  if (isAirborne) {
    ud.flipAngle += dtVisual * 11;
    ud.rig.rotation.x = ud.flipAngle;
  } else {
    ud.flipAngle = 0;
    ud.rig.rotation.x += ((isMoving ? 0.36 : 0.04) - ud.rig.rotation.x) * damp;
  }

  const armTarget = isMoving ? -1.15 : -0.15;
  ud.leftArm.rotation.x += (armTarget - ud.leftArm.rotation.x) * damp;
  ud.rightArm.rotation.x += (armTarget - ud.rightArm.rotation.x) * damp;
  const stride = isMoving ? Math.sin(visualClock * 18) * 0.72 : 0;
  ud.leftLeg.rotation.x = stride;
  ud.rightLeg.rotation.x = -stride;

  ud.scarfSegments.forEach((seg, idx) => {
    seg.rotation.y = Math.sin(visualClock * (isMoving ? 14 : 4) - idx * 0.9) * (isMoving ? 0.32 : 0.1);
  });

  ud.dashCooldown -= dtVisual;
  if ((isMoving || p.dashTicks > 0) && !isAirborne && ud.dashCooldown <= 0) {
    spawnDashPuff([px, py, pz]);
    ud.dashCooldown = p.dashTicks > 0 ? 0.04 : 0.1;
  }

  const carryRatio = p.carried / TUNING.carry_capacity;
  ud.playerLight.intensity = 3.8 + carryRatio * 4.2;
  ud.miniLanternMat.emissiveIntensity = 1.8 + carryRatio * 2.5;

  // Lanterns: fuel bar, 1Hz low-fuel blink, squashed 20% + torn paper when unlit
  const blinkOn = Math.floor(visualClock * 2) % 2 === 0; // 1 Hz blink
  let litCount = 0;
  for (const l of engine.lanterns) {
    if (l.lit) litCount += 1;
    const v = lanternViews.get(l.id);
    if (!v) continue;
    const cost = l.everLit ? TUNING.relight_cost : TUNING.lantern_cost;
    const prog = l.deposited / cost;
    const fuelPct = l.lit ? Math.max(0, Math.min(1, l.fuelUnits / 6000)) : 0;
    const isLowFuel = l.lit && l.fuelUnits < 1800;

    if (l.lit) {
      v.userData.core.scale.y = 1.0;
      v.userData.ripGroup.visible = false;
      v.userData.coreMat.color.setHex(COLORS.lanternCore);
      v.userData.coreMat.emissiveIntensity = isLowFuel ? (blinkOn ? 2.6 : 0.45) : 2.8;
      v.userData.light.intensity = isLowFuel ? (blinkOn ? 18 : 6) : 22;
      v.userData.ringMat.opacity = isLowFuel ? 0 : 0.3;

      v.userData.fuelBarGroup.visible = true;
      v.userData.fuelBarGroup.lookAt(camera.position);
      v.userData.fuelFill.scale.x = Math.max(0.01, fuelPct);
      v.userData.fuelFill.position.x = -(1 - fuelPct) * 0.85;
      v.userData.fuelFillMat.color.setHex(
        isLowFuel ? (settings.colorblind ? 0xffffff : 0xff5a5f) : COLORS.lanternLit
      );
      v.userData.fuelFill.visible = !isLowFuel || blinkOn;
    } else {
      // Unlit: squashed 20% + visible paper tear strips (distinguishable without color)
      v.userData.core.scale.y = 0.8;
      v.userData.ripGroup.visible = true;
      v.userData.coreMat.color.setHex(COLORS.lanternUnlit);
      v.userData.coreMat.emissiveIntensity = 0.1 + prog * 1.4;
      v.userData.light.intensity = prog > 0 ? 2 + prog * 6 : 0;
      v.userData.ringMat.opacity = 0;
      v.userData.fuelBarGroup.visible = false;
    }
  }
  ambientLight.intensity = 0.15 + 0.55 * (litCount / engine.lanterns.length);

  // Motes sync
  const activeMotes = new Set(engine.motes.map((m) => m.id));
  for (const [id, mesh] of moteViews.entries()) {
    if (!activeMotes.has(id)) {
      dynamicGroup.remove(mesh);
      moteViews.delete(id);
    }
  }
  for (const m of engine.motes) {
    let mesh = moteViews.get(m.id);
    if (!mesh) {
      mesh = createMoteView(m);
      moteViews.set(m.id, mesh);
    }
    mesh.position.set(m.pos[0], m.pos[1] + 0.85 + Math.sin(visualClock * 3.8 + m.pos[0]) * 0.22, m.pos[2]);
  }

  // Shades sync
  const activeShades = new Set(engine.shades.map((s) => s.id));
  for (const [id, mesh] of shadeViews.entries()) {
    if (!activeShades.has(id)) {
      dynamicGroup.remove(mesh);
      shadeViews.delete(id);
    }
  }
  for (const s of engine.shades) {
    let mesh = shadeViews.get(s.id);
    if (!mesh) {
      mesh = createShadeView(s);
      shadeViews.set(s.id, mesh);
    }
    const prevS = prevShadePositions.get(s.id) || s.pos;
    const sx = prevS[0] + (s.pos[0] - prevS[0]) * alpha;
    const sy = prevS[1] + (s.pos[1] - prevS[1]) * alpha;
    const sz = prevS[2] + (s.pos[2] - prevS[2]) * alpha;
    mesh.position.set(sx, sy + Math.sin(visualClock * 3.5 + sz) * 0.18, sz);
    mesh.lookAt(px, sy, pz);

    const { rig, bodyMat, eyeMat, ringMat } = mesh.userData;
    const rimHex = settings.colorblind ? 0x00b3ff : COLORS.shadeRim;
    bodyMat.emissive.setHex(rimHex);
    eyeMat.color.setHex(settings.colorblind ? 0x00b3ff : 0x9ef7ff);
    ringMat.color.setHex(rimHex);
    if (s.state === 'stunned') {
      bodyMat.color.setHex(COLORS.shadeStun);
      bodyMat.opacity = 0.5;
      rig.rotation.z = Math.sin(visualClock * 20) * 0.25;
    } else {
      bodyMat.color.setHex(COLORS.shadeBody);
      bodyMat.opacity = s.state === 'spawning' ? 0.35 : 0.86;
      rig.rotation.z = Math.sin(visualClock * (s.state === 'drain' ? 14 : 4)) * (s.state === 'drain' ? 0.16 : 0.08);
    }
  }

  // Drifters (Gió Lạc) sync
  for (const d of engine.drifters) {
    let mesh = drifterViews.get(d.id);
    if (d.state === 'removed') {
      if (mesh) {
        dynamicGroup.remove(mesh);
        drifterViews.delete(d.id);
      }
      continue;
    }
    if (!mesh) {
      mesh = createDrifterView(d);
      drifterViews.set(d.id, mesh);
    }
    mesh.position.set(d.pos[0], d.pos[1] + Math.sin(visualClock * 6) * 0.2, d.pos[2]);
    mesh.lookAt(px, d.pos[1], pz);
    mesh.userData.seg2.rotation.y = Math.sin(visualClock * 12) * 0.4;
  }

  // Charms (Bùa Gió) sync
  for (const c of engine.charms) {
    const mesh = charmViews.get(c.id);
    if (mesh) {
      mesh.visible = c.available;
      mesh.rotation.y = visualClock * 2.5;
      mesh.position.y = c.pos[1] + 1.0 + Math.sin(visualClock * 3) * 0.2;
    }
  }

  // Wind leaves animation (Night 3)
  if (windLeaves.length > 0) {
    const showLeaves = engine.wind.warning || engine.wind.active;
    const rad = (engine.wind.dirDeg * Math.PI) / 180;
    const spd = engine.wind.active ? 22 : 10;
    for (const lf of windLeaves) {
      lf.mesh.visible = showLeaves;
      if (showLeaves) {
        lf.x += Math.cos(rad) * spd * dtVisual;
        lf.z += Math.sin(rad) * spd * dtVisual;
        if (Math.abs(lf.x) > 45) lf.x = -Math.sign(lf.x) * 44;
        if (Math.abs(lf.z) > 45) lf.z = -Math.sign(lf.z) * 44;
        lf.mesh.position.set(lf.x, lf.y + Math.sin(visualClock * 5 + lf.x) * 0.4, lf.z);
        lf.mesh.rotation.set(visualClock * 4, visualClock * 3, 0);
      }
    }
  }

  // Temporary particle pools
  for (let i = dashTrails.length - 1; i >= 0; i--) {
    const d = dashTrails[i];
    d.age += dtVisual;
    d.mat.opacity = Math.max(0, (1 - d.age / d.maxAge) * 0.5);
    if (d.age >= d.maxAge) { dynamicGroup.remove(d.mesh); d.mat.dispose(); dashTrails.splice(i, 1); }
  }
  for (let i = skyLanterns.length - 1; i >= 0; i--) {
    const sl = skyLanterns[i];
    sl.age += dtVisual;
    sl.mesh.position.y += sl.vy * dtVisual;
    sl.mesh.position.x += sl.dx * dtVisual;
    sl.mesh.position.z += sl.dz * dtVisual;
    sl.mat.opacity = Math.max(0, 1 - sl.age / sl.maxAge);
    if (sl.age >= sl.maxAge) { dynamicGroup.remove(sl.mesh); sl.mat.dispose(); skyLanterns.splice(i, 1); }
  }
  for (let i = pulseRings.length - 1; i >= 0; i--) {
    const pr = pulseRings[i];
    pr.age += dtVisual;
    const t = Math.min(1, pr.age / pr.duration);
    pr.mesh.scale.setScalar(1 + t * (TUNING.pulse_radius / 0.92));
    pr.mat.opacity = (1 - t) * 0.9;
    if (pr.age >= pr.duration) { dynamicGroup.remove(pr.mesh); pr.mat.dispose(); pulseRings.splice(i, 1); }
  }

  // Top-down camera
  const theta = (camYawDeg * Math.PI) / 180;
  const camDist = 15 * camZoom;
  const camHeight = 23 * camZoom;
  camTargetVec.set(px + Math.sin(theta) * camDist, Math.max(0, py) + camHeight, pz + Math.cos(theta) * camDist);
  const camAlpha = dtVisual > 0 ? 1 - Math.exp(-9 * dtVisual) : 1;
  camera.position.lerp(camTargetVec, camAlpha);
  camera.lookAt(px, Math.max(0, py) + 0.6, pz);

  updateOffscreenLanternArrow();
}

function updateOffscreenLanternArrow() {
  if (!engine || screenMode !== 'playing') {
    lanternArrowEl.classList.add('hidden');
    return;
  }
  const p = engine.player;
  let nearest = null;
  let bestD = Infinity;
  for (const l of engine.lanterns) {
    if (l.lit) continue;
    const d = distXZ(p.pos, l.pos);
    if (d < bestD) { bestD = d; nearest = l; }
  }
  if (!nearest) {
    lanternArrowEl.classList.add('hidden');
    return;
  }
  const proj = new THREE.Vector3(nearest.pos[0], nearest.pos[1] + 2.5, nearest.pos[2]).project(camera);
  const onScreen = proj.z < 1 && Math.abs(proj.x) <= 0.92 && Math.abs(proj.y) <= 0.92;
  if (onScreen) {
    lanternArrowEl.classList.add('hidden');
    return;
  }
  let sx = proj.x;
  let sy = proj.y;
  if (proj.z > 1) { sx = -sx; sy = -sy; }
  const angle = Math.atan2(-sy, sx);
  const padX = window.innerWidth * 0.44;
  const padY = window.innerHeight * 0.4;
  const x = window.innerWidth / 2 + Math.cos(angle) * padX;
  const y = window.innerHeight / 2 + Math.sin(angle) * padY;
  lanternArrowEl.style.left = `${x - 17}px`;
  lanternArrowEl.style.top = `${y - 17}px`;
  lanternArrowEl.style.transform = `rotate(${(angle * 180) / Math.PI}deg)`;
  lanternArrowEl.classList.remove('hidden');
}

function updateHUD() {
  if (!engine) return;
  const p = engine.player;
  const cap = engine.getCarryCapacity();
  const threshold = Math.ceil(TUNING.win_ratio * engine.lanterns.length);
  hudFlames.textContent = p.flames > 0 ? '🔥'.repeat(p.flames) : '💨';
  const litCount = engine.lanterns.filter((l) => l.lit).length;
  hudLanterns.textContent = `${litCount} / ${engine.lanterns.length} (≥${threshold})`;
  hudScore.textContent = String(engine.score);

  // Dynamic firefly capacity bar (10..20 slots)
  moteCapLabel.textContent = `Đom đóm: ${p.carried} / ${cap}`;
  for (let i = 0; i < moteSlots.length; i++) {
    moteSlots[i].classList.toggle('hidden', i >= cap);
    moteSlots[i].classList.toggle('filled', i < p.carried);
  }

  // Clock + danger blink <= 30s (with ⚠ in colorblind mode) + 10s countdown beep
  const sec = Math.ceil(engine.getTimeLeftS());
  const mm = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');
  const isDanger = sec <= 30;
  hudTime.textContent = isDanger && settings.colorblind ? `⚠ ${mm}:${ss}` : `${mm}:${ss}`;
  hudTime.classList.toggle('danger', isDanger);
  if (sec <= 10 && sec > 0 && sec !== lastCountdownSec && screenMode === 'playing') {
    lastCountdownSec = sec;
    sfx.playCountdown();
  }

  // Wind indicator (Night 3)
  if (engine.wind.active) {
    hudWind.textContent = `🌪 Gió mạnh (${Math.round(engine.wind.dirDeg)}°)`;
    hudWind.classList.remove('hidden');
  } else if (engine.wind.warning) {
    hudWind.textContent = '🍃 Gió mạnh sắp thổi!';
    hudWind.classList.remove('hidden');
    if (!prevWindWarning) sfx.playWindWarn();
  } else {
    hudWind.classList.add('hidden');
  }
  prevWindWarning = engine.wind.warning;

  // Wind Charm pill
  if (p.charmTicks > 0) {
    hudCharm.classList.remove('hidden');
    hudCharmVal.textContent = `${(p.charmTicks / 60).toFixed(1)}s`;
  } else {
    hudCharm.classList.add('hidden');
  }

  // Dash & Pulse cooldown icons
  if (p.charmTicks > 0) {
    cdDashEl.classList.remove('cooldown');
    cdDashVal.textContent = 'Không CD!';
  } else if (p.dashCdTicks > 0) {
    cdDashEl.classList.add('cooldown');
    cdDashVal.textContent = `${(p.dashCdTicks / 60).toFixed(1)}s`;
  } else {
    cdDashEl.classList.remove('cooldown');
    cdDashVal.textContent = 'Sẵn sàng';
  }

  if (p.pulseCdTicks > 0) {
    cdPulseEl.classList.add('cooldown');
    cdPulseVal.textContent = `${(p.pulseCdTicks / 60).toFixed(1)}s`;
  } else if (p.carried < TUNING.pulse_cost) {
    cdPulseEl.classList.add('cooldown');
    cdPulseVal.textContent = `Cần ${TUNING.pulse_cost}✨`;
  } else {
    cdPulseEl.classList.remove('cooldown');
    cdPulseVal.textContent = 'Sẵn sàng';
  }

  // Lantern prompt (light, relight, or refuel)
  const nearLantern = engine.lanterns.find(
    (l) => (!l.lit || l.fuelUnits < 6000) && distXZ(p.pos, l.pos) <= TUNING.interact_radius && Math.abs(p.pos[1] - l.pos[1]) <= 2.0
  );
  if (nearLantern) {
    if (!nearLantern.lit) {
      const cost = nearLantern.everLit ? TUNING.relight_cost : TUNING.lantern_cost;
      hudPrompt.textContent = nearLantern.everLit
        ? `E — Thắp lại (${nearLantern.deposited}/${cost})`
        : `E — Nạp ánh sáng (${nearLantern.deposited}/${cost})`;
    } else {
      hudPrompt.textContent = `E — Châm dầu (${Math.round(nearLantern.fuelUnits / 60)}%)`;
    }
    hudPrompt.classList.remove('hidden');
  } else {
    hudPrompt.classList.add('hidden');
  }
}

let prevJump = false;

function animate(now) {
  requestAnimationFrame(animate);
  const frameDt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  if ((screenMode === 'playing' || screenMode === 'paused') && engine) {
    if (screenMode === 'paused') {
      if (pendingPauseToggle) {
        const evs = engine.step(readLiveInput(frameDt));
        handleEvents(evs);
      }
    } else {
      accumulator += frameDt;
      const liveInput = readLiveInput(frameDt);
      if (liveInput.jump && !prevJump && engine.player.grounded) sfx.playJump();
      prevJump = liveInput.jump;
      while (accumulator >= DT && (engine.state === 'playing' || engine.state === 'paused')) {
        capturePrevState();
        const events = engine.step(liveInput);
        handleEvents(events);
        accumulator -= DT;
        if (engine.state === 'paused') break;
      }
      const alpha = Math.min(1, accumulator / DT);
      syncViews(frameDt, alpha);
      updateHUD();
    }
  } else {
    animateScenery(frameDt);
    const t = now * 0.00022;
    const cx = currentNight === 2 ? 35 : 0;
    camera.position.set(cx + Math.sin(t) * 42, 30, Math.cos(t) * 42);
    camera.lookAt(cx, 1, 0);
  }

  composer.render();
}

showMainMenu();
requestAnimationFrame(animate);
