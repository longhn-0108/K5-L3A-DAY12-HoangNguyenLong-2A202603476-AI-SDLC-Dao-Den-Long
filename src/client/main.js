import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { GameEngine } from '../sim/engine.js';
import { SeededPRNG } from '../sim/prng.js';
import { getMapConfig } from '../sim/maps.js';
import { DT, SHADE_HEIGHT, TUNING, distXZ } from '../sim/tuning.js';
import { SoundFX } from './audio.js';

const URL_PARAMS = new URLSearchParams(window.location.search);
const IS_BENCH = URL_PARAMS.get('bench') === '1';
const BENCH_SEED = Number(URL_PARAMS.get('seed')) || 42;
const BENCH_DURATION = Number(URL_PARAMS.get('duration')) || 30;

// Standardized Color Palette (TICKET-02 / 03)
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
const keyDashBadge = document.getElementById('key-dash-badge');
const keyPulseBadge = document.getElementById('key-pulse-badge');
const lanternArrowEl = document.getElementById('lantern-arrow');
const shadeArrowEl = document.getElementById('shade-arrow');
const subtitleBar = document.getElementById('subtitle-bar');

const btnMute = document.getElementById('btn-mute');
const btnPause = document.getElementById('btn-pause');

const overlayEl = document.getElementById('overlay');
const overlayEyebrow = document.getElementById('overlay-eyebrow');
const overlayTitle = document.getElementById('overlay-title');
const overlayDesc = document.getElementById('overlay-desc');
const overlayStats = document.getElementById('overlay-stats');
const menuControls = document.getElementById('menu-controls');
const btnPrimary = document.getElementById('btn-primary');
const btnLeaderboard = document.getElementById('btn-leaderboard');
const btnSecondary = document.getElementById('btn-secondary');
const btnOpenSettings = document.getElementById('btn-open-settings');
const nightSelectEl = document.getElementById('night-select');
const btnNight1 = document.getElementById('btn-night-1');
const btnNight2 = document.getElementById('btn-night-2');
const btnNight3 = document.getElementById('btn-night-3');

const lbSaveBox = document.getElementById('lb-save-box');
const lbNameInput = document.getElementById('lb-name-input');
const btnLbSave = document.getElementById('btn-lb-save');
const lbSaveMsg = document.getElementById('lb-save-msg');
const lbModal = document.getElementById('lb-modal');
const lbTableWrap = document.getElementById('lb-table-wrap');
const btnCloseLb = document.getElementById('btn-close-lb');

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
const optReduceMotion = document.getElementById('opt-reduce-motion');
const optLargeText = document.getElementById('opt-large-text');
const keybindListEl = document.getElementById('keybind-list');
const keybindWarnEl = document.getElementById('keybind-warn');
const btnResetKeys = document.getElementById('btn-reset-keys');
const btnCloseSettings = document.getElementById('btn-close-settings');

// Dynamic firefly bar (up to 20 slots)
const moteSlots = [];
for (let i = 0; i < TUNING.capacity_max; i++) {
  const slot = document.createElement('div');
  slot.className = 'mote-slot';
  if (i >= TUNING.carry_capacity) slot.classList.add('hidden');
  moteBarEl.appendChild(slot);
  moteSlots.push(slot);
}

// Persistent Settings + Rebindable Controls
const DEFAULT_KEYBINDS = {
  moveUp: 'KeyW',
  moveDown: 'KeyS',
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  jump: 'Space',
  dash: 'ShiftLeft',
  interact: 'KeyE',
  pulse: 'KeyR',
  pause: 'Escape',
};
const KEYBIND_LABELS = {
  moveUp: 'Tiến lên',
  moveDown: 'Lùi xuống',
  moveLeft: 'Sang trái',
  moveRight: 'Sang phải',
  jump: 'Nhảy',
  dash: 'Lướt',
  interact: 'Tương tác đèn',
  pulse: 'Tỏa sáng',
  pause: 'Tạm dừng',
};

const SETTINGS_KEY = 'dao_den_long_settings_v2';
const settings = {
  volume: 0.7,
  sensitivity: 1.0,
  colorblind: false,
  reduceMotion: false,
  largeText: false,
  keybinds: { ...DEFAULT_KEYBINDS },
};

try {
  const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  if (typeof saved.volume === 'number') settings.volume = saved.volume;
  if (typeof saved.sensitivity === 'number') settings.sensitivity = saved.sensitivity;
  if (typeof saved.colorblind === 'boolean') settings.colorblind = saved.colorblind;
  if (typeof saved.reduceMotion === 'boolean') settings.reduceMotion = saved.reduceMotion;
  if (typeof saved.largeText === 'boolean') settings.largeText = saved.largeText;
  if (saved.keybinds && typeof saved.keybinds === 'object') {
    settings.keybinds = { ...DEFAULT_KEYBINDS, ...saved.keybinds };
  }
} catch {}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
}

function formatKeyCode(code) {
  return String(code).replace(/^Key/, '').replace(/^Digit/, '').replace('ShiftLeft', 'Shift').replace('ShiftRight', 'RShift');
}

function applySettingsToUI() {
  optVolume.value = String(Math.round(settings.volume * 100));
  optVolumeVal.textContent = `${Math.round(settings.volume * 100)}%`;
  optSens.value = String(Math.round(settings.sensitivity * 100));
  optSensVal.textContent = `${settings.sensitivity.toFixed(1)}×`;
  optColorblind.checked = settings.colorblind;
  optReduceMotion.checked = settings.reduceMotion;
  optLargeText.checked = settings.largeText;
  document.body.classList.toggle('colorblind', settings.colorblind);
  document.body.classList.toggle('reduce-motion', settings.reduceMotion);
  document.body.classList.toggle('large-text', settings.largeText);
  keyDashBadge.textContent = formatKeyCode(settings.keybinds.dash);
  keyPulseBadge.textContent = formatKeyCode(settings.keybinds.pulse);
}

let listeningAction = null;

function renderKeybinds() {
  keybindListEl.innerHTML = '';
  for (const [action, label] of Object.entries(KEYBIND_LABELS)) {
    const row = document.createElement('div');
    row.className = 'kb-row';
    const span = document.createElement('span');
    span.textContent = label;
    const btn = document.createElement('button');
    btn.className = 'kb-btn' + (listeningAction === action ? ' listening' : '');
    btn.textContent = listeningAction === action ? 'Nhấn phím...' : formatKeyCode(settings.keybinds[action]);
    btn.onclick = () => {
      listeningAction = action;
      keybindWarnEl.textContent = '';
      renderKeybinds();
    };
    row.append(span, btn);
    keybindListEl.appendChild(row);
  }
}

const sfx = new SoundFX();
sfx.setVolume(settings.volume);
applySettingsToUI();
renderKeybinds();

optVolume.addEventListener('input', () => {
  settings.volume = Number(optVolume.value) / 100;
  sfx.setVolume(settings.volume);
  applySettingsToUI();
  saveSettings();
});
optSens.addEventListener('input', () => {
  settings.sensitivity = Number(optSens.value) / 100;
  applySettingsToUI();
  saveSettings();
});
optColorblind.addEventListener('change', () => {
  settings.colorblind = optColorblind.checked;
  applySettingsToUI();
  saveSettings();
});
optReduceMotion.addEventListener('change', () => {
  settings.reduceMotion = optReduceMotion.checked;
  applySettingsToUI();
  saveSettings();
});
optLargeText.addEventListener('change', () => {
  settings.largeText = optLargeText.checked;
  applySettingsToUI();
  saveSettings();
});
btnResetKeys.addEventListener('click', () => {
  settings.keybinds = { ...DEFAULT_KEYBINDS };
  listeningAction = null;
  keybindWarnEl.textContent = 'Đã khôi phục phím mặc định.';
  applySettingsToUI();
  renderKeybinds();
  saveSettings();
});

// Visual Subtitle helper
let subtitleTimer = null;
function showSubtitle(text) {
  if (IS_BENCH) return;
  subtitleBar.textContent = settings.colorblind ? `⚠ ${text}` : text;
  subtitleBar.classList.remove('hidden');
  clearTimeout(subtitleTimer);
  subtitleTimer = setTimeout(() => subtitleBar.classList.add('hidden'), 2800);
}

// Leaderboard API (persisted on disk via /api/leaderboard with localStorage mirror)
const LB_LOCAL_KEY = 'dao_den_long_lb_fallback';
async function fetchLeaderboard() {
  try {
    const res = await fetch('/api/leaderboard');
    if (res.ok) return await res.json();
  } catch {}
  try {
    return JSON.parse(localStorage.getItem(LB_LOCAL_KEY) || '{"entries":[]}');
  } catch {
    return { entries: [] };
  }
}

async function submitLeaderboard(entry) {
  try {
    const res = await fetch('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    if (res.ok) return await res.json();
    const err = await res.json();
    throw new Error(err.error || 'Lỗi lưu bảng xếp hạng');
  } catch (err) {
    if (err.message && err.message.includes('Tên')) throw err;
    const local = await fetchLeaderboard();
    const entries = [...local.entries, { ...entry, achieved_at: new Date().toISOString() }]
      .sort((a, b) => b.score - a.score || a.achieved_at.localeCompare(b.achieved_at))
      .slice(0, 10);
    const out = { entries };
    localStorage.setItem(LB_LOCAL_KEY, JSON.stringify(out));
    return out;
  }
}

async function openLeaderboardModal() {
  const data = await fetchLeaderboard();
  if (!data.entries || data.entries.length === 0) {
    lbTableWrap.innerHTML = '<p class="desc">Chưa có điểm nào được lưu.</p>';
  } else {
    const rows = data.entries
      .map(
        (e, i) =>
          `<tr><td>#${i + 1}</td><td>${e.name}</td><td>${e.score}</td><td>${e.nights_won}/3</td><td>${e.seed}</td></tr>`
      )
      .join('');
    lbTableWrap.innerHTML = `<table class="lb-table"><thead><tr><th>Hạng</th><th>Tên</th><th>Điểm</th><th>Đêm</th><th>Seed</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  lbModal.classList.remove('hidden');
}

btnNight1.addEventListener('click', () => showNightIntro(1));
btnNight2.addEventListener('click', () => showNightIntro(2));
btnNight3.addEventListener('click', () => showNightIntro(3));

btnLeaderboard.addEventListener('click', openLeaderboardModal);
btnCloseLb.addEventListener('click', () => lbModal.classList.add('hidden'));

// Renderer, Scene, Camera, Bloom
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(IS_BENCH ? 1 : Math.min(window.devicePixelRatio, 2));
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
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.36, 0.6, 0.78);
composer.addPass(bloomPass);

const ambientLight = new THREE.AmbientLight(0xd8e0ff, 0.15);
scene.add(ambientLight);
const hemiLight = new THREE.HemisphereLight(0x8aa4ff, 0x263166, 0.88);
scene.add(hemiLight);
const moonLight = new THREE.DirectionalLight(0xd4e2ff, 1.05);
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

const SHARED = {
  moteOrb: new THREE.SphereGeometry(0.24, 14, 14),
  moteHalo: new THREE.SphereGeometry(0.46, 12, 12),
  dashPuff: new THREE.SphereGeometry(0.2, 10, 10),
  skyLantern: new THREE.CylinderGeometry(0.18, 0.13, 0.38, 10),
  pulseRing: new THREE.RingGeometry(0.5, 0.92, 48),
  ghostHead: new THREE.SphereGeometry(0.46, 16, 16),
  ghostSkirt: new THREE.ConeGeometry(0.76, 1.35, 16, 1, true),
  ghostEye: new THREE.SphereGeometry(0.09, 10, 10),
  ghostRing: new THREE.RingGeometry(0.78, 1.08, 28),
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
const clientPropColliders = []; // Live-client solid colliders for trees/rocks/lanterns (never affects headless)
const sparkParticles = [];
const afterimages = [];
let ambientEmbers = null;
let mooredBoat = null;
let templeBell = null;
let tier2Mesh = null;
let rainSystem = null;
const RAIN_COUNT = 220;

// Procedural organic noise texture (breaks up flat/cartoony surfaces with zero external assets)
function makeOrganicTexture(baseHex, grainHex, size = 128) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = `#${baseHex.toString(16).padStart(6, '0')}`;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = grainHex;
  for (let i = 0; i < 900; i++) {
    const x = (i * 73) % size;
    const y = (i * 137) % size;
    const w = 1 + (i % 3);
    ctx.globalAlpha = 0.08 + ((i % 5) * 0.025);
    ctx.fillRect(x, y, w, w);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  return tex;
}

const ORGANIC_TEX = {
  grass: makeOrganicTexture(COLORS.grass, '#18332c'),
  sand: makeOrganicTexture(COLORS.sand, '#8c7a58'),
  wood: makeOrganicTexture(COLORS.wood, '#3d2817'),
};

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
  while (grp.children.length > 0) grp.remove(grp.children[0]);
}

function buildIslandVisuals(night, benchMode = false) {
  clearGroup(worldGroup);
  swayTrees.length = 0;
  windLeaves.length = 0;
  cloudPuffs.length = 0;
  padRings.length = 0;
  clientPropColliders.length = 0;
  mooredBoat = null;
  templeBell = null;
  tier2Mesh = null;
  rainSystem = null;

  const rng = makeVisualRng(2026 + night * 97);
  const cfg = getMapConfig(night);

  const grassMat = new THREE.MeshStandardMaterial({ color: COLORS.grass, map: ORGANIC_TEX.grass, roughness: 0.92, metalness: 0.05 });
  const sandMat = new THREE.MeshStandardMaterial({ color: COLORS.sand, map: ORGANIC_TEX.sand, roughness: 0.94, metalness: 0.04 });
  const woodMat = new THREE.MeshStandardMaterial({ color: COLORS.wood, map: ORGANIC_TEX.wood, roughness: 0.86, metalness: 0.08 });
  const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x4f3520, roughness: 0.92 });
  const cloudMat = new THREE.MeshStandardMaterial({ color: COLORS.cloudSea, emissive: 0x091c26, emissiveIntensity: 0.45, roughness: 0.95 });

  const cloudPlane = new THREE.Mesh(new THREE.CircleGeometry(190, 40), cloudMat);
  cloudPlane.rotation.x = -Math.PI / 2;
  cloudPlane.position.y = -11;
  worldGroup.add(cloudPlane);

  const cloudCenterX = night === 2 ? 35 : 0;

  if (!benchMode) {
    const puffGeo = new THREE.DodecahedronGeometry(1, 1);
    const cloudBaseR = night === 2 ? 68 : night === 3 ? 52 : 47;
    for (let i = 0; i < 38; i++) {
      const a = (i / 38) * Math.PI * 2 + (i % 3) * 0.15;
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
  }

  const starPos = new Float32Array(300 * 3);
  for (let i = 0; i < 300; i++) {
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

  const rockMat = new THREE.MeshStandardMaterial({ color: 0x4a5266, roughness: 0.92 });
  const mushCapMat = new THREE.MeshStandardMaterial({ color: 0x7dfce4, emissive: 0x2ee0c0, emissiveIntensity: 1.7 });
  const mushStemMat = new THREE.MeshStandardMaterial({ color: COLORS.mayTunic });
  const blossomMat = new THREE.MeshStandardMaterial({ color: 0xd482a6, emissive: 0x4d1d36, emissiveIntensity: 0.4 });
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
      g.add(c1);
    } else {
      const lm = pineMats[Math.floor(rng() * pineMats.length)];
      for (let tier = 0; tier < 3; tier++) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry((1.4 - tier * 0.3) * scale, (1.6 - tier * 0.18) * scale, 6), lm);
        cone.position.y = (1.85 + tier * 0.92) * scale;
        g.add(cone);
      }
    }
    worldGroup.add(g);
    swayTrees.push({ group: g, phase: rng() * Math.PI * 2 });
    clientPropColliders.push({ x, y, z, r: 0.65 * scale });
  }

  function addCauPalm(x, y, z, scale) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * scale, 0.22 * scale, 4.6 * scale, 10), woodMat);
    trunk.position.y = 2.3 * scale;
    g.add(trunk);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.32 * scale, 2.1 * scale, 7), pineMats[1]);
      frond.position.set(Math.cos(a) * 0.85 * scale, 4.55 * scale, Math.sin(a) * 0.85 * scale);
      frond.rotation.z = -Math.cos(a) * 1.15;
      frond.rotation.x = Math.sin(a) * 1.15;
      g.add(frond);
    }
    worldGroup.add(g);
    swayTrees.push({ group: g, phase: rng() * Math.PI * 2 });
    clientPropColliders.push({ x, y, z, r: 0.45 * scale });
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
        worldGroup.add(rock);
        clientPropColliders.push({ x, y, z, r: 0.62 * s });
      } else {
        const ms = 0.75 + rng() * 0.35;
        const stem = new THREE.Mesh(mushStemGeo, mushStemMat);
        stem.scale.setScalar(ms);
        stem.position.set(x, y + 0.17 * ms, z);
        const cap = new THREE.Mesh(mushCapGeo, mushCapMat);
        cap.scale.setScalar(ms);
        cap.position.set(x, y + 0.4 * ms, z);
        worldGroup.add(stem, cap);
      }
    }
  }

  const avoidAll = [...cfg.lanterns.map((l) => l.pos), ...cfg.jumpPads.map((p) => p.pos), [0, 0, 0]];

  if (night === 1) {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(40, 35.5, 4.5, 56), grassMat);
    disc.position.y = -2.25;
    disc.receiveShadow = true;
    worldGroup.add(disc);

    const plaza = new THREE.Mesh(new THREE.CircleGeometry(5.5, 28), sandMat);
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.y = 0.03;
    worldGroup.add(plaza);

    if (!benchMode) {
      for (const l of cfg.lanterns) {
        const len = Math.hypot(l.pos[0], l.pos[2]) - 4;
        const ang = Math.atan2(l.pos[0], l.pos[2]);
        const spoke = new THREE.Mesh(new THREE.PlaneGeometry(1.9, len), sandMat);
        spoke.rotation.x = -Math.PI / 2;
        spoke.rotation.z = ang;
        spoke.position.set(l.pos[0] * 0.52, 0.024, l.pos[2] * 0.52);
        worldGroup.add(spoke);
      }

      const pier = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.42, 8.5), woodMat);
      pier.position.set(0, 0.12, 42);
      worldGroup.add(pier);

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

      for (let i = 0; i < 28; i++) {
        const r = i < 20 ? 30 + rng() * 7.5 : 13 + rng() * 8;
        const a = (i / (i < 20 ? 20 : 8)) * Math.PI * 2;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        if (Math.abs(x) < 4.5 && z > 32) continue;
        if (avoidAll.some((p) => Math.hypot(x - p[0], z - p[2]) < 5.0)) continue;
        addPineOrBlossom(x, 0, z, 0.85 + rng() * 0.45, i % 5 === 0);
      }
      addPropsInRing(0, 0, 0, 8, 36, 22, avoidAll);
    }
  } else if (night === 2) {
    for (const cx of [0, 70]) {
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(28, 24.5, 4.5, 48), grassMat);
      disc.position.set(cx, -2.25, 0);
      disc.receiveShadow = true;
      worldGroup.add(disc);
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        const r = 14 + rng() * 11;
        const x = cx + Math.cos(a) * r;
        const z = Math.sin(a) * r;
        if (Math.abs(z) < 4 && ((cx === 0 && x > 22) || (cx === 70 && x < 48))) continue;
        if (avoidAll.some((p) => Math.hypot(x - p[0], z - p[2]) < 4.8)) continue;
        if (i % 3 === 0) addPineOrBlossom(x, 0, z, 0.85 + rng() * 0.35, true);
        else addCauPalm(x, 0, z, 0.85 + rng() * 0.45);
      }
      addPropsInRing(cx, 0, 0, 6, 24, 12, avoidAll);
    }
    const bridgeBase = new THREE.Mesh(new THREE.BoxGeometry(18, 0.32, 4), woodMat);
    bridgeBase.position.set(35, -0.16, 0);
    worldGroup.add(bridgeBase);
    const slatGeo = new THREE.BoxGeometry(0.45, 0.12, 3.9);
    for (let bx = 26.5; bx <= 43.5; bx += 0.9) {
      const slat = new THREE.Mesh(slatGeo, bx % 1.8 < 0.9 ? sandMat : darkWoodMat);
      slat.position.set(bx, 0.04, 0);
      worldGroup.add(slat);
    }
  } else {
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
    worldGroup.add(tier1);

    // Tier 2: elevated temple platform disc at Y = 6 (r = 8); auto-fades translucent when Mây is underneath!
    const tier2Mat = new THREE.MeshStandardMaterial({
      color: COLORS.sand,
      map: ORGANIC_TEX.sand,
      roughness: 0.9,
      transparent: true,
      opacity: 1.0,
    });
    const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 0.7, 32), tier2Mat);
    tier2.position.y = 5.65;
    tier2.receiveShadow = true;
    worldGroup.add(tier2);
    tier2Mesh = tier2;
    for (let i = 0; i < 4; i++) {
      const pa = ((45 + i * 90) * Math.PI) / 180;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 5.5, 10), woodMat);
      col.position.set(Math.cos(pa) * 6.5, 2.75, Math.sin(pa) * 6.5);
      worldGroup.add(col);
    }
    // Warm guiding bell-tower beacon light so Night 3 is clear & dramatic
    const bellBeacon = new THREE.PointLight(COLORS.lanternLit, 14, 55, 1.1);
    bellBeacon.position.set(0, 14, 0);
    worldGroup.add(bellBeacon);

    // 2 straight 3m-wide ramps at 30° and 150° from r=30 (Y=0) up to r=24 (Y=3)
    const torchMat = new THREE.MeshStandardMaterial({ color: COLORS.lanternCore, emissive: COLORS.lanternLit, emissiveIntensity: 2.6 });
    for (const deg of [30, 150]) {
      const rad = (deg * Math.PI) / 180;
      const rampPivot = new THREE.Group();
      rampPivot.position.set(Math.cos(rad) * 27, 1.5, Math.sin(rad) * 27);
      rampPivot.rotation.y = -rad; // local +X points radially outward (r=30 at +3, r=24 at -3)
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(6, 3), 0.35, 3), woodMat);
      ramp.rotation.z = Math.atan2(-3, 6); // slopes DOWN toward +X (r=30, Y=0) and UP toward -X (r=24, Y=3)
      ramp.receiveShadow = true;
      rampPivot.add(ramp);
      worldGroup.add(rampPivot);

      // Glowing golden torches marking the ramp entrance at r=30.5
      for (const side of [-1.7, 1.7]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1.5, 6), woodMat);
        const orb = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 10), torchMat);
        const px = Math.cos(rad) * 30.5 - Math.sin(rad) * side;
        const pz = Math.sin(rad) * 30.5 + Math.cos(rad) * side;
        post.position.set(px, 0.75, pz);
        orb.position.set(px, 1.65, pz);
        worldGroup.add(post, orb);
      }
    }

    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 8, 16), woodMat);
    tower.position.set(0, 10, 0);
    const bellRoof = new THREE.Mesh(new THREE.ConeGeometry(3.4, 2.4, 8), new THREE.MeshStandardMaterial({ color: COLORS.mayScarf }));
    bellRoof.position.set(0, 15.1, 0);
    const bell = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.4, 12), new THREE.MeshStandardMaterial({ color: COLORS.gold }));
    bell.position.set(0, 13.0, 0);
    worldGroup.add(tower, bellRoof, bell);
    templeBell = bell;

    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const r = 32 + rng() * 10;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (avoidAll.some((p) => Math.hypot(x - p[0], z - p[2]) < 5.0)) continue;
      addPineOrBlossom(x, 0, z, 0.9 + rng() * 0.45, i % 4 === 0);
    }
    addPropsInRing(0, 0, 0, 26, 42, 20, avoidAll);

    const leafMat = new THREE.MeshBasicMaterial({ color: COLORS.gold, side: THREE.DoubleSide });
    const leafGeo = new THREE.PlaneGeometry(0.42, 0.22);
    for (let i = 0; i < 40; i++) {
      const m = new THREE.Mesh(leafGeo, leafMat);
      m.visible = false;
      worldGroup.add(m);
      windLeaves.push({ mesh: m, x: (rng() - 0.5) * 76, y: 1 + rng() * 8, z: (rng() - 0.5) * 76 });
    }
  }

  const padMat = new THREE.MeshStandardMaterial({ color: COLORS.gold, emissive: COLORS.lanternLit, emissiveIntensity: 1.8 });
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

// Ninja Mây
function buildPlayerMesh() {
  const root = new THREE.Group();
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

  const armGeo = new THREE.CapsuleGeometry(0.09, 0.44, 6, 10);
  const leftArm = new THREE.Mesh(armGeo, tunicMat);
  leftArm.position.set(-0.42, 0.92, -0.1);
  const rightArm = new THREE.Mesh(armGeo, tunicMat);
  rightArm.position.set(0.42, 0.92, -0.1);
  rig.add(leftArm, rightArm);

  // Mây's signature weapon: Lantern-Keeper's Spirit Staff (Trượng Đèn Lồng Ánh Sáng — equipped from start)
  const staffPivot = new THREE.Group();
  staffPivot.position.set(0.54, 0.95, 0.16);
  const staffShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.065, 2.7, 10),
    new THREE.MeshStandardMaterial({ color: COLORS.gold, roughness: 0.4, metalness: 0.5 })
  );
  staffShaft.position.y = 0.35;
  const staffRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.32, 0.05, 10, 22),
    new THREE.MeshStandardMaterial({ color: COLORS.gold, emissive: COLORS.lanternLit, emissiveIntensity: 1.1, metalness: 0.8, roughness: 0.2 })
  );
  staffRing.position.y = 1.85;
  const staffCoreMat = new THREE.MeshStandardMaterial({
    color: COLORS.lanternCore,
    emissive: COLORS.lanternLit,
    emissiveIntensity: 3.4,
  });
  const staffCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), staffCoreMat);
  staffCore.position.y = 1.85;
  staffPivot.add(staffShaft, staffRing, staffCore);
  staffPivot.rotation.x = 0.65;
  rig.add(staffPivot);

  const scarfSegments = [];
  for (let i = 0; i < 3; i++) {
    const seg = new THREE.Mesh(new THREE.BoxGeometry(0.24 - i * 0.04, 0.07, 0.46), scarfMat);
    seg.position.set(0, 1.18 - i * 0.06, -0.35 - i * 0.38);
    rig.add(seg);
    scarfSegments.push(seg);
  }

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 10), new THREE.MeshStandardMaterial({ color: 0xffe4c7 }));
  head.position.y = 1.42;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.86, 0.44, 18), new THREE.MeshStandardMaterial({ color: COLORS.sand }));
  hat.position.y = 1.72;
  rig.add(head, hat);

  const lanternPivot = new THREE.Group();
  lanternPivot.position.set(0.64, 1.54, 0.16);
  const miniLanternMat = new THREE.MeshStandardMaterial({ color: COLORS.lanternCore, emissive: COLORS.lanternLit, emissiveIntensity: 2.2 });
  const miniLantern = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), miniLanternMat);
  miniLantern.position.y = -0.28;
  lanternPivot.add(miniLantern);
  rig.add(lanternPivot);

  const playerLight = new THREE.PointLight(COLORS.lanternLit, 4.5, 18, 1.3);
  playerLight.position.set(0, 2.3, 0);
  root.add(playerLight);

  root.userData = {
    rig,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    staffPivot,
    staffCoreMat,
    scarfSegments,
    lanternPivot,
    miniLanternMat,
    playerLight,
    flipAngle: 0,
    staffSpin: 0,
    wasAirborne: false,
    dashCooldown: 0,
    smoothYaw: 0,
  };
  scene.add(root);
  return root;
}

const playerMesh = buildPlayerMesh();

// Dynamic entity views
const lanternViews = new Map();
const moteViews = new Map();
const shadeViews = new Map();
const drifterViews = new Map();
const charmViews = new Map();
const skyLanterns = [];
const pulseRings = [];
const dashTrails = [];

const moteOrbMat = new THREE.MeshStandardMaterial({ color: COLORS.moteCore, emissive: COLORS.moteHalo, emissiveIntensity: 2.6 });
const moteHaloMat = new THREE.MeshBasicMaterial({ color: COLORS.moteHalo, transparent: true, opacity: 0.3 });

function createLanternView(l) {
  const g = new THREE.Group();
  g.position.set(l.pos[0], l.pos[1], l.pos[2]);

  const poleMat = new THREE.MeshStandardMaterial({ color: COLORS.wood, roughness: 0.85 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 2.8, 8), poleMat);
  pole.position.y = 1.4;
  g.add(pole);

  const coreMat = new THREE.MeshStandardMaterial({ color: COLORS.lanternUnlit, emissive: COLORS.lanternLit, emissiveIntensity: 0.1 });
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.55, 1.25, 8), coreMat);
  core.position.y = 3.2;
  g.add(core);

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

  const fuelBarGroup = new THREE.Group();
  fuelBarGroup.position.y = 5.0;
  const fuelBg = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.22, 0.12), new THREE.MeshBasicMaterial({ color: 0x16182b }));
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
  const mat = new THREE.MeshStandardMaterial({ color: COLORS.drifter, emissive: 0x4b647d, emissiveIntensity: 0.8, transparent: true, opacity: 0.85 });
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
  const card = new THREE.Mesh(SHARED.charmCard, new THREE.MeshStandardMaterial({ color: COLORS.mayScarf, emissive: COLORS.mayScarf, emissiveIntensity: 0.9 }));
  const border = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.68, 0.05), new THREE.MeshStandardMaterial({ color: COLORS.gold, emissive: COLORS.gold, emissiveIntensity: 1.2 }));
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

function spawnSparkBurst(originPos, colorHex = COLORS.moteHalo, count = 16, speed = 5.5) {
  if (IS_BENCH || settings.reduceMotion) return;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.3;
    const spd = speed * (0.5 + Math.random() * 0.8);
    const mat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.95 });
    const mesh = new THREE.Mesh(SHARED.dashPuff, mat);
    mesh.scale.setScalar(0.55);
    mesh.position.set(originPos[0], originPos[1] + 0.9, originPos[2]);
    dynamicGroup.add(mesh);
    sparkParticles.push({
      mesh,
      mat,
      vx: Math.cos(a) * spd,
      vy: 1.5 + Math.random() * 3.5,
      vz: Math.sin(a) * spd,
      age: 0,
      maxAge: 0.45 + Math.random() * 0.25,
    });
  }
}

function spawnAfterimage(pos, yaw) {
  if (IS_BENCH || settings.reduceMotion) return;
  const mat = new THREE.MeshBasicMaterial({ color: COLORS.gold, transparent: true, opacity: 0.42 });
  const ghost = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.3, 10), mat);
  ghost.position.set(pos[0], pos[1] + 0.72, pos[2]);
  ghost.rotation.y = yaw;
  dynamicGroup.add(ghost);
  afterimages.push({ mesh: ghost, mat, age: 0, maxAge: 0.28 });
}

// ============================================================================
// BENCHMARK MODE (?bench=1&seed=42&duration=30)
// ============================================================================
function runBenchmarkMode() {
  overlayEl.classList.add('hidden');
  hudEl.classList.add('hidden');
  buildIslandVisuals(1, true);
  clearGroup(dynamicGroup);

  const prng = new SeededPRNG(BENCH_SEED);
  const cfg = getMapConfig(1);

  // 3 lanterns L1-L3 lit with fuel 100, L4-L5 unlit
  for (let i = 0; i < cfg.lanterns.length; i++) {
    const l = { ...cfg.lanterns[i], lit: i < 3, deposited: i < 3 ? 10 : 0, fuelUnits: i < 3 ? 6000 : 0 };
    const v = createLanternView(l);
    if (l.lit) {
      v.userData.coreMat.color.setHex(COLORS.lanternCore);
      v.userData.coreMat.emissiveIntensity = 2.8;
      v.userData.light.intensity = 22;
      v.userData.ringMat.opacity = 0.28;
      v.userData.ripGroup.visible = false;
    } else {
      v.userData.core.scale.y = 0.8;
    }
  }
  ambientLight.intensity = 0.15 + 0.55 * (3 / 5);

  // 200 Shades in wander state via InstancedMesh (high-FPS)
  const shadeData = [];
  for (let i = 0; i < 200; i++) {
    const r = Math.sqrt(prng.next()) * 37 + 1.5;
    const a = prng.range(0, Math.PI * 2);
    shadeData.push({
      x: Math.cos(a) * r,
      z: Math.sin(a) * r,
      ang: prng.range(0, Math.PI * 2),
    });
  }
  const shadeMat = new THREE.MeshStandardMaterial({ color: COLORS.shadeBody, emissive: COLORS.shadeRim, emissiveIntensity: 0.9 });
  const shadeInst = new THREE.InstancedMesh(SHARED.ghostSkirt, shadeMat, 200);
  dynamicGroup.add(shadeInst);

  // 100 Motes via InstancedMesh
  const moteInst = new THREE.InstancedMesh(SHARED.moteOrb, moteOrbMat, 100);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 100; i++) {
    const r = Math.sqrt(prng.next()) * 36 + 2;
    const a = prng.range(0, Math.PI * 2);
    dummy.position.set(Math.cos(a) * r, 0.9, Math.sin(a) * r);
    dummy.updateMatrix();
    moteInst.setMatrixAt(i, dummy.matrix);
  }
  moteInst.instanceMatrix.needsUpdate = true;
  dynamicGroup.add(moteInst);

  playerMesh.position.set(0, 0, 0);

  const warmupMs = 3000;
  const measureMs = BENCH_DURATION * 1000;
  const dts = [];
  let startTime = null;
  let lastFrame = null;
  let readySent = false;
  let peakMemMb = null;
  let simAcc = 0;

  const gl = renderer.getContext();
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const gpuName = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'WebGL';
  const rendererDesc = `Three.js r${THREE.REVISION} WebGLRenderer (${gpuName})`;

  function benchLoop(now) {
    if (startTime === null) {
      startTime = now;
      lastFrame = now;
    }
    const dtMs = now - lastFrame;
    lastFrame = now;
    const elapsedMs = now - startTime;

    // Update 200 wandering shades at fixed 60Hz
    simAcc += Math.min(0.05, dtMs / 1000);
    while (simAcc >= DT) {
      for (let i = 0; i < 200; i++) {
        const s = shadeData[i];
        s.ang += 0.02;
        const nx = s.x + Math.cos(s.ang) * (TUNING.shade_speed * 0.4) * DT;
        const nz = s.z + Math.sin(s.ang) * (TUNING.shade_speed * 0.4) * DT;
        if (Math.hypot(nx, nz) <= 39) {
          s.x = nx;
          s.z = nz;
        } else {
          s.ang += Math.PI * 0.7;
        }
      }
      simAcc -= DT;
    }

    for (let i = 0; i < 200; i++) {
      const s = shadeData[i];
      dummy.position.set(s.x, SHADE_HEIGHT, s.z);
      dummy.updateMatrix();
      shadeInst.setMatrixAt(i, dummy.matrix);
    }
    shadeInst.instanceMatrix.needsUpdate = true;

    // Camera orbit: R=30, Y=15, CCW from above starting at (30,15,0), 15s/rev
    const angle = ((elapsedMs / 1000) / 15) * Math.PI * 2;
    camera.position.set(30 * Math.cos(angle), 15, -30 * Math.sin(angle));
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);

    if (!readySent) {
      readySent = true;
      fetch('/__bench_ready', { method: 'POST' }).catch(() => {});
    }

    if (elapsedMs >= warmupMs) {
      if (dtMs > 0) dts.push(dtMs);
      if (performance.memory && performance.memory.usedJSHeapSize) {
        const mb = Math.round((performance.memory.usedJSHeapSize / (1024 * 1024)) * 10) / 10;
        if (peakMemMb === null || mb > peakMemMb) peakMemMb = mb;
      }
    }

    if (elapsedMs >= warmupMs + measureMs) {
      const N = dts.length;
      const sumDt = dts.reduce((a, b) => a + b, 0);
      const avgFps = Math.round(((1000 * N) / sumDt) * 10) / 10;
      const sorted = [...dts].sort((a, b) => a - b);
      const k = Math.max(1, Math.ceil(0.01 * N));
      const worstK = sorted.slice(N - k);
      const p1LowFps = Math.round((1000 / (worstK.reduce((a, b) => a + b, 0) / k)) * 10) / 10;
      const p95 = Math.round(sorted[Math.min(N - 1, Math.floor(0.95 * N))] * 10) / 10;

      fetch('/__bench_result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frames: N,
          avg_fps: avgFps,
          p1_low_fps: p1LowFps,
          frame_ms_p95: p95,
          peak_mem_mb: peakMemMb,
          renderer: rendererDesc,
        }),
      }).catch(() => {});
      return;
    }

    requestAnimationFrame(benchLoop);
  }

  requestAnimationFrame(benchLoop);
}

// ============================================================================
// NORMAL GAMEPLAY MODE
// ============================================================================
let currentNight = 1;
let totalCampaignScore = 0;
let nightsWonCount = 0;
let currentSeed = 1;
let engine = null;
let screenMode = 'menu';
let accumulator = 0;
let lastTime = performance.now();
let visualClock = 0;
let lastCountdownSec = -1;
let prevWindWarning = false;
let lastSpawnedShadePos = null;
let shadeArrowTimer = 0;
let lowFuelWarnedIds = new Set();

let prevPlayerPos = [0, 0, 0];
const prevShadePositions = new Map();
const camTargetVec = new THREE.Vector3();

const keys = new Set();
let pendingPauseToggle = false;
let camYawDeg = 0;
let camZoom = 1.0;
let dragging = false;
let lastMouseX = 0;

window.addEventListener('keydown', (e) => {
  if (listeningAction) {
    e.preventDefault();
    const code = e.code;
    const conflict = Object.entries(settings.keybinds).find(([act, c]) => act !== listeningAction && c === code);
    if (conflict) {
      keybindWarnEl.textContent = `⚠ Phím ${formatKeyCode(code)} đã được gán cho "${KEYBIND_LABELS[conflict[0]]}"!`;
      return;
    }
    settings.keybinds[listeningAction] = code;
    listeningAction = null;
    keybindWarnEl.textContent = '';
    applySettingsToUI();
    renderKeybinds();
    saveSettings();
    return;
  }

  if (document.activeElement && document.activeElement.tagName === 'INPUT') return;

  keys.add(e.code);
  if (e.code === 'KeyM') btnMute.textContent = sfx.toggleMute() ? '🔇' : '🔊';
  if ((e.code === settings.keybinds.pause || e.code === 'KeyP') && (screenMode === 'playing' || screenMode === 'paused')) {
    pendingPauseToggle = true;
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));

canvas.addEventListener('mousedown', (e) => {
  if (e.button === 0) { dragging = true; lastMouseX = e.clientX; }
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
btnCloseSettings.addEventListener('click', () => { listeningAction = null; settingsModal.classList.add('hidden'); });
btnPauseMenu.addEventListener('click', () => { pauseModal.classList.add('hidden'); showMainMenu(); });

btnLbSave.addEventListener('click', async () => {
  const name = lbNameInput.value.trim();
  try {
    await submitLeaderboard({
      name,
      score: totalCampaignScore,
      nights_won: nightsWonCount,
      seed: currentSeed,
    });
    lbSaveMsg.textContent = 'Đã lưu vào Bảng Xếp Hạng!';
    lbSaveMsg.classList.remove('warn');
    btnLbSave.disabled = true;
  } catch (err) {
    lbSaveMsg.textContent = err.message;
    lbSaveMsg.classList.add('warn');
  }
});

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
  nightsWonCount = 0;
  hudEl.classList.add('hidden');
  lanternArrowEl.classList.add('hidden');
  shadeArrowEl.classList.add('hidden');
  lbSaveBox.classList.add('hidden');
  overlayEl.classList.remove('hidden');
  overlayStats.classList.add('hidden');
  menuControls.classList.remove('hidden');
  nightSelectEl.classList.remove('hidden');
  btnSecondary.classList.add('hidden');
  btnLeaderboard.classList.remove('hidden');
  overlayEyebrow.textContent = 'Phiên bản phát hành v1.0.0';
  overlayTitle.textContent = 'Đảo Đèn Lồng';
  overlayDesc.innerHTML = 'Giúp <strong>Mây</strong> thắp và <strong>giữ ít nhất 60% Đèn Lồng Lớn sáng tới bình minh</strong> qua <strong>3 Đêm</strong>.';
  btnPrimary.textContent = 'Bắt đầu Đêm 1';
  btnPrimary.onclick = () => showNightIntro(1);
  buildIslandVisuals(1, false);
}

function showNightIntro(night) {
  currentNight = night;
  screenMode = 'intro';
  const cfg = getMapConfig(night);
  buildIslandVisuals(night, false);
  hudEl.classList.add('hidden');
  lanternArrowEl.classList.add('hidden');
  shadeArrowEl.classList.add('hidden');
  lbSaveBox.classList.add('hidden');
  overlayEl.classList.remove('hidden');
  overlayStats.classList.add('hidden');
  menuControls.classList.add('hidden');
  nightSelectEl.classList.add('hidden');
  btnLeaderboard.classList.add('hidden');
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
  buildIslandVisuals(night, false);

  currentSeed = Math.floor(Math.random() * 100000) + 1;
  engine = new GameEngine({ seed: currentSeed, night });
  camYawDeg = 0;
  camZoom = 1.0;
  accumulator = 0;
  lastCountdownSec = -1;
  prevWindWarning = false;
  lastSpawnedShadePos = null;
  shadeArrowTimer = 0;
  lowFuelWarnedIds = new Set();
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
  nightSelectEl.classList.add('hidden');
  lanternArrowEl.classList.add('hidden');
  shadeArrowEl.classList.add('hidden');
  btnSecondary.classList.remove('hidden');
  btnSecondary.textContent = 'Về Menu';
  btnSecondary.onclick = showMainMenu;
  btnLeaderboard.classList.remove('hidden');

  const litCount = engine.lanterns.filter((l) => l.lit).length;
  let allowSave = false;

  if (result === 'won') {
    totalCampaignScore += engine.score;
    nightsWonCount = Math.max(nightsWonCount, currentNight);
    sfx.playWin();
    if (currentNight < 3) {
      overlayEyebrow.textContent = `Sống sót tới Bình Minh — Đêm ${currentNight}`;
      overlayTitle.textContent = `${engine.map.name} Đã Sáng!`;
      overlayDesc.textContent = 'Bạn đã giữ vững ánh sáng tới bình minh. Chuẩn bị sang hòn đảo tiếp theo!';
      btnPrimary.textContent = `Sang Đêm ${currentNight + 1}`;
      btnPrimary.onclick = () => showNightIntro(currentNight + 1);
    } else {
      allowSave = true;
      overlayEyebrow.textContent = 'Bình Minh Đã Trở Lại';
      overlayTitle.textContent = 'Chúc Mừng! Phá Đảo Đèn Lồng!';
      overlayDesc.textContent = `Mây đã giữ sáng cả Ba Hòn Đảo. Tổng điểm toàn hành trình: ${totalCampaignScore}.`;
      btnPrimary.textContent = 'Chơi lại từ Đêm 1';
      btnPrimary.onclick = () => { totalCampaignScore = 0; nightsWonCount = 0; showNightIntro(1); };
    }
  } else {
    allowSave = true;
    sfx.playLose();
    overlayEyebrow.textContent = `Thất bại — Đêm ${currentNight}`;
    overlayTitle.textContent = reason === 'dawn' ? 'Không Đủ Đèn Sáng...' : 'Ngọn Lửa Đã Tắt...';
    overlayDesc.textContent = reason === 'dawn' ? 'Bình minh đã lên nhưng số đèn sáng chưa đạt 60%.' : 'Mây đã mất hết Ngọn Lửa.';
    btnPrimary.textContent = `Chơi lại Đêm ${currentNight}`;
    btnPrimary.onclick = () => startNight(currentNight);
  }

  lbSaveBox.classList.toggle('hidden', !allowSave);
  btnLbSave.disabled = false;
  lbSaveMsg.textContent = '';

  overlayStats.innerHTML = `
    <div class="stat-box"><div class="k">Điểm Đêm ${currentNight}</div><div class="v">${engine.score}</div></div>
    <div class="stat-box"><div class="k">Đèn sáng</div><div class="v">${litCount} / ${engine.lanterns.length}</div></div>
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
      spawnSparkBurst(engine.player.pos, COLORS.moteCore, 8, 3.8);
    } else if (ev.name === 'charm_picked') {
      sfx.playCharm();
      spawnSparkBurst(engine.player.pos, COLORS.mayScarf, 18, 6.2);
      showSubtitle('Đã nhặt Bùa Gió! Tốc độ tăng & Lướt không hồi chiêu!');
    } else if (ev.name === 'deposit' || ev.name === 'refuel') {
      sfx.playDeposit();
      spawnSparkBurst(engine.player.pos, COLORS.lanternLit, 10, 4.2);
    } else if (ev.name === 'lantern_out') {
      sfx.playHit();
      showSubtitle(`Đèn ${ev.data.lantern_id} đã cạn dầu và tắt!`);
    } else if (ev.name === 'lantern_lit') {
      sfx.playLanternLit();
      const l = engine.lanterns.find((x) => x.id === ev.data.lantern_id);
      if (l) {
        spawnSkyLanterns(l.pos);
        spawnSparkBurst(l.pos, COLORS.lanternLit, 22, 6.5);
      }
    } else if (ev.name === 'pulse') {
      sfx.playPulse();
      playerMesh.userData.staffSpin = Math.PI * 2;
      spawnPulseRing(engine.player.pos);
      spawnSparkBurst(engine.player.pos, COLORS.gold, 24, 8.0);
    } else if (ev.name === 'dash') {
      sfx.playDash();
      spawnDashPuff(engine.player.pos);
      spawnAfterimage(engine.player.pos, playerMesh.rotation.y);
      spawnSparkBurst(engine.player.pos, COLORS.moteHalo, 10, 4.5);
    } else if (ev.name === 'player_hit') {
      sfx.playHit();
      spawnSparkBurst(engine.player.pos, COLORS.shadeRim, 16, 5.5);
    } else if (ev.name === 'shade_spawned') {
      sfx.playShadeSpawn();
      const s = engine.shades.find((x) => x.id === ev.data.id);
      if (s) {
        lastSpawnedShadePos = [...s.pos];
        shadeArrowTimer = 3.5;
      }
      showSubtitle(`Bóng Mực ${ev.data.id} vừa xuất hiện!`);
    } else if (ev.name === 'game_over') {
      showNightResult(ev.data.result, ev.data.reason);
    }
  }
}

function readLiveInput(dtVisual) {
  const kb = settings.keybinds;
  const rotSpeed = 125 * dtVisual * settings.sensitivity;
  if (keys.has('ArrowLeft') || keys.has('KeyQ')) camYawDeg = (camYawDeg + rotSpeed) % 360;
  if (keys.has('ArrowRight')) camYawDeg = (camYawDeg - rotSpeed + 360) % 360;

  let mx = 0;
  let mz = 0;
  if (keys.has(kb.moveUp) || keys.has('ArrowUp')) mz -= 1;
  if (keys.has(kb.moveDown) || keys.has('ArrowDown')) mz += 1;
  if (keys.has(kb.moveLeft)) mx -= 1;
  if (keys.has(kb.moveRight)) mx += 1;

  const pauseVal = pendingPauseToggle;
  pendingPauseToggle = false;

  return {
    move: [mx, mz],
    cam_yaw_deg: camYawDeg,
    jump: keys.has(kb.jump),
    interact: keys.has(kb.interact) || keys.has('KeyF'),
    pulse: keys.has(kb.pulse),
    dash: keys.has(kb.dash) || keys.has('ShiftRight'),
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
  if (!settings.reduceMotion) {
    for (const t of swayTrees) t.group.rotation.z = Math.sin(visualClock * 1.4 + t.phase) * 0.036;
    for (const c of cloudPuffs) c.mesh.position.y = c.baseY + Math.sin(visualClock * 0.7 + c.phase) * 0.38;
    if (mooredBoat) {
      mooredBoat.position.y = -0.35 + Math.sin(visualClock * 1.8) * 0.14;
      mooredBoat.rotation.z = Math.sin(visualClock * 1.3) * 0.05;
    }
    if (templeBell) templeBell.rotation.z = Math.sin(visualClock * 2.1) * (engine?.wind?.active ? 0.28 : 0.06);
  }
  for (const pr of padRings) {
    const p = (visualClock * 1.1) % 1;
    pr.mesh.position.y = pr.baseY + p * 1.8;
    pr.mesh.scale.setScalar(1 + p * 0.45);
    pr.mesh.material.opacity = (1 - p) * 0.8;
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

function placeEdgeArrow(el, worldPos) {
  const proj = new THREE.Vector3(worldPos[0], worldPos[1] + 2.0, worldPos[2]).project(camera);
  if (proj.z < 1 && Math.abs(proj.x) <= 0.92 && Math.abs(proj.y) <= 0.92) {
    el.classList.add('hidden');
    return;
  }
  let sx = proj.x;
  let sy = proj.y;
  if (proj.z > 1) { sx = -sx; sy = -sy; }
  const angle = Math.atan2(-sy, sx);
  const x = window.innerWidth / 2 + Math.cos(angle) * (window.innerWidth * 0.44);
  const y = window.innerHeight / 2 + Math.sin(angle) * (window.innerHeight * 0.4);
  el.style.left = `${x - 18}px`;
  el.style.top = `${y - 18}px`;
  el.style.transform = `rotate(${(angle * 180) / Math.PI}deg)`;
  el.classList.remove('hidden');
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
  playerMesh.visible = p.respawnWaitTicks === 0 && (p.invulnTicks === 0 || settings.reduceMotion || Math.floor(visualClock * 16) % 2 === 0);

  if (isAirborne && !settings.reduceMotion) {
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

  // Lantern Staff dynamic combat/sprint sweep + 360° Pulse slash spin
  if (ud.staffSpin > 0) {
    const stepSpin = Math.min(ud.staffSpin, dtVisual * 18);
    ud.staffSpin -= stepSpin;
    ud.staffPivot.rotation.y += stepSpin;
    ud.staffPivot.rotation.x = 1.1;
  } else {
    ud.staffPivot.rotation.y += (0 - ud.staffPivot.rotation.y) * damp;
    const targetStaffX = isMoving ? -0.95 : 0.45 + Math.sin(visualClock * 2.5) * 0.08;
    ud.staffPivot.rotation.x += (targetStaffX - ud.staffPivot.rotation.x) * damp;
  }
  ud.staffCoreMat.emissiveIntensity = 2.0 + (p.carried / Math.max(1, engine.getCarryCapacity())) * 2.5;

  // Landing dust burst
  if (ud.wasAirborne && !isAirborne) {
    spawnSparkBurst([px, py, pz], COLORS.sand, 8, 3.0);
  }
  ud.wasAirborne = isAirborne;

  // Dash afterimage trail
  if (p.dashTicks > 0 && p.dashTicks % 3 === 0) {
    spawnAfterimage([px, py, pz], ud.smoothYaw);
  }

  // Flowing ninja scarf wave
  ud.scarfSegments.forEach((seg, idx) => {
    seg.rotation.y = Math.sin(visualClock * (isMoving ? 15 : 4) - idx * 0.9) * (isMoving ? 0.35 : 0.1);
    seg.rotation.x = isMoving ? 0.18 + idx * 0.08 : -0.22 - idx * 0.08;
  });

  const blinkOn = settings.reduceMotion || Math.floor(visualClock * 2) % 2 === 0;
  let litCount = 0;
  for (const l of engine.lanterns) {
    if (l.lit) litCount += 1;
    const v = lanternViews.get(l.id);
    if (!v) continue;
    const cost = l.everLit ? TUNING.relight_cost : TUNING.lantern_cost;
    const prog = l.deposited / cost;
    const fuelPct = l.lit ? Math.max(0, Math.min(1, l.fuelUnits / 6000)) : 0;
    const isLowFuel = l.lit && l.fuelUnits < 1800;

    if (isLowFuel && !lowFuelWarnedIds.has(l.id)) {
      lowFuelWarnedIds.add(l.id);
      showSubtitle(`Đèn ${l.id} sắp cạn dầu (<30%)!`);
    } else if (!isLowFuel) {
      lowFuelWarnedIds.delete(l.id);
    }

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
      v.userData.fuelFillMat.color.setHex(isLowFuel ? (settings.colorblind ? 0xffffff : 0xff5a5f) : COLORS.lanternLit);
      v.userData.fuelFill.visible = !isLowFuel || blinkOn;
    } else {
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

  // Motes, Shades, Drifters, Charms
  const activeMotes = new Set(engine.motes.map((m) => m.id));
  for (const [id, mesh] of moteViews.entries()) if (!activeMotes.has(id)) { dynamicGroup.remove(mesh); moteViews.delete(id); }
  for (const m of engine.motes) {
    let mesh = moteViews.get(m.id);
    if (!mesh) { mesh = createMoteView(m); moteViews.set(m.id, mesh); }
    mesh.position.set(m.pos[0], m.pos[1] + 0.85 + Math.sin(visualClock * 3.8 + m.pos[0]) * 0.2, m.pos[2]);
  }

  const activeShades = new Set(engine.shades.map((s) => s.id));
  for (const [id, mesh] of shadeViews.entries()) if (!activeShades.has(id)) { dynamicGroup.remove(mesh); shadeViews.delete(id); }
  for (const s of engine.shades) {
    let mesh = shadeViews.get(s.id);
    if (!mesh) { mesh = createShadeView(s); shadeViews.set(s.id, mesh); }
    const prevS = prevShadePositions.get(s.id) || s.pos;
    const sx = prevS[0] + (s.pos[0] - prevS[0]) * alpha;
    const sy = prevS[1] + (s.pos[1] - prevS[1]) * alpha;
    const sz = prevS[2] + (s.pos[2] - prevS[2]) * alpha;
    mesh.position.set(sx, sy + Math.sin(visualClock * 3.5 + sz) * 0.16, sz);
    mesh.lookAt(px, sy, pz);
    const { bodyMat, eyeMat, ringMat } = mesh.userData;
    const rimHex = settings.colorblind ? 0x00b3ff : COLORS.shadeRim;
    bodyMat.emissive.setHex(rimHex);
    eyeMat.color.setHex(settings.colorblind ? 0x00b3ff : 0x9ef7ff);
    ringMat.color.setHex(rimHex);
    bodyMat.color.setHex(s.state === 'stunned' ? COLORS.shadeStun : COLORS.shadeBody);
  }

  for (const d of engine.drifters) {
    let mesh = drifterViews.get(d.id);
    if (d.state === 'removed') { if (mesh) { dynamicGroup.remove(mesh); drifterViews.delete(d.id); } continue; }
    if (!mesh) { mesh = createDrifterView(d); drifterViews.set(d.id, mesh); }
    mesh.position.set(d.pos[0], d.pos[1], d.pos[2]);
    mesh.lookAt(px, d.pos[1], pz);
  }

  for (const c of engine.charms) {
    const mesh = charmViews.get(c.id);
    if (mesh) { mesh.visible = c.available; mesh.rotation.y = visualClock * 2.5; }
  }

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
  for (let i = sparkParticles.length - 1; i >= 0; i--) {
    const sp = sparkParticles[i];
    sp.age += dtVisual;
    sp.mesh.position.x += sp.vx * dtVisual;
    sp.mesh.position.y += sp.vy * dtVisual;
    sp.mesh.position.z += sp.vz * dtVisual;
    sp.vy -= 9.5 * dtVisual;
    sp.mat.opacity = Math.max(0, 1 - sp.age / sp.maxAge);
    if (sp.age >= sp.maxAge) { dynamicGroup.remove(sp.mesh); sp.mat.dispose(); sparkParticles.splice(i, 1); }
  }
  for (let i = afterimages.length - 1; i >= 0; i--) {
    const ai = afterimages[i];
    ai.age += dtVisual;
    ai.mat.opacity = Math.max(0, (1 - ai.age / ai.maxAge) * 0.42);
    if (ai.age >= ai.maxAge) { dynamicGroup.remove(ai.mesh); ai.mesh.geometry.dispose(); ai.mat.dispose(); afterimages.splice(i, 1); }
  }

  // Auto-fade Night 3 Tier 2 roof when Mây is underneath so she is never hidden!
  if (tier2Mesh) {
    const underTier2 = py < 5.0 && Math.hypot(px, pz) < 9.5;
    tier2Mesh.material.opacity = underTier2 ? 0.22 : 1.0;
    tier2Mesh.material.depthWrite = !underTier2;
  }

  const theta = (camYawDeg * Math.PI) / 180;
  camTargetVec.set(px + Math.sin(theta) * 15 * camZoom, Math.max(0, py) + 23 * camZoom, pz + Math.cos(theta) * 15 * camZoom);
  camera.position.lerp(camTargetVec, dtVisual > 0 ? 1 - Math.exp(-9 * dtVisual) : 1);
  camera.lookAt(px, Math.max(0, py) + 0.6, pz);

  // Off-screen lantern arrow
  let nearest = null;
  let bestD = Infinity;
  for (const l of engine.lanterns) {
    if (l.lit) continue;
    const d = distXZ(p.pos, l.pos);
    if (d < bestD) { bestD = d; nearest = l; }
  }
  if (nearest && screenMode === 'playing') placeEdgeArrow(lanternArrowEl, nearest.pos);
  else lanternArrowEl.classList.add('hidden');

  // Newly spawned shade edge arrow
  if (shadeArrowTimer > 0 && lastSpawnedShadePos && screenMode === 'playing') {
    shadeArrowTimer -= dtVisual;
    placeEdgeArrow(shadeArrowEl, lastSpawnedShadePos);
  } else {
    shadeArrowEl.classList.add('hidden');
  }
}

function updateHUD() {
  if (!engine) return;
  const p = engine.player;
  const cap = engine.getCarryCapacity();
  const threshold = Math.ceil(TUNING.win_ratio * engine.lanterns.length);
  hudFlames.textContent = p.flames > 0 ? '🔥'.repeat(p.flames) : '💨';
  hudLanterns.textContent = `${engine.lanterns.filter((l) => l.lit).length} / ${engine.lanterns.length} (≥${threshold})`;
  hudScore.textContent = String(engine.score);

  moteCapLabel.textContent = `Đom đóm: ${p.carried} / ${cap}`;
  for (let i = 0; i < moteSlots.length; i++) {
    moteSlots[i].classList.toggle('hidden', i >= cap);
    moteSlots[i].classList.toggle('filled', i < p.carried);
  }

  const sec = Math.ceil(engine.getTimeLeftS());
  const mm = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');
  const isDanger = sec <= 30;
  hudTime.textContent = isDanger && settings.colorblind ? `⚠ ${mm}:${ss}` : `${mm}:${ss}`;
  hudTime.classList.toggle('danger', isDanger);
  if (sec <= 10 && sec > 0 && sec !== lastCountdownSec && screenMode === 'playing') {
    lastCountdownSec = sec;
    sfx.playCountdown();
    if (sec === 10) showSubtitle('Còn 10 giây cuối trước bình minh!');
  }

  if (engine.wind.active) {
    hudWind.textContent = `🌪 Gió mạnh (${Math.round(engine.wind.dirDeg)}°)`;
    hudWind.classList.remove('hidden');
  } else if (engine.wind.warning) {
    hudWind.textContent = '🍃 Gió mạnh sắp thổi!';
    hudWind.classList.remove('hidden');
    if (!prevWindWarning) { sfx.playWindWarn(); showSubtitle('Gió mạnh sắp thổi!'); }
  } else {
    hudWind.classList.add('hidden');
  }
  prevWindWarning = engine.wind.warning;

  if (p.charmTicks > 0) {
    hudCharm.classList.remove('hidden');
    hudCharmVal.textContent = `${(p.charmTicks / 60).toFixed(1)}s`;
  } else hudCharm.classList.add('hidden');

  if (p.charmTicks > 0) { cdDashEl.classList.remove('cooldown'); cdDashVal.textContent = 'Không CD!'; }
  else if (p.dashCdTicks > 0) { cdDashEl.classList.add('cooldown'); cdDashVal.textContent = `${(p.dashCdTicks / 60).toFixed(1)}s`; }
  else { cdDashEl.classList.remove('cooldown'); cdDashVal.textContent = 'Sẵn sàng'; }

  if (p.pulseCdTicks > 0) { cdPulseEl.classList.add('cooldown'); cdPulseVal.textContent = `${(p.pulseCdTicks / 60).toFixed(1)}s`; }
  else if (p.carried < TUNING.pulse_cost) { cdPulseEl.classList.add('cooldown'); cdPulseVal.textContent = `Cần ${TUNING.pulse_cost}✨`; }
  else { cdPulseEl.classList.remove('cooldown'); cdPulseVal.textContent = 'Sẵn sàng'; }

  const nearLantern = engine.lanterns.find(
    (l) => (!l.lit || l.fuelUnits < 6000) && distXZ(p.pos, l.pos) <= TUNING.interact_radius && Math.abs(p.pos[1] - l.pos[1]) <= 2.0
  );
  if (nearLantern) {
    const k = formatKeyCode(settings.keybinds.interact);
    if (!nearLantern.lit) {
      const cost = nearLantern.everLit ? TUNING.relight_cost : TUNING.lantern_cost;
      hudPrompt.textContent = nearLantern.everLit ? `${k} — Thắp lại (${nearLantern.deposited}/${cost})` : `${k} — Nạp ánh sáng (${nearLantern.deposited}/${cost})`;
    } else {
      hudPrompt.textContent = `${k} — Châm dầu (${Math.round(nearLantern.fuelUnits / 60)}%)`;
    }
    hudPrompt.classList.remove('hidden');
  } else hudPrompt.classList.add('hidden');
}

function resolveClientPropCollisions() {
  if (!engine || engine.player.respawnWaitTicks > 0) return;
  const p = engine.player.pos;
  const playerR = 0.48;
  // Collide smoothly against decorative trees/rocks
  for (const prop of clientPropColliders) {
    if (Math.abs(p[1] - prop.y) > 1.8) continue;
    const dx = p[0] - prop.x;
    const dz = p[2] - prop.z;
    const minDist = prop.r + playerR;
    const d = Math.hypot(dx, dz);
    if (d < minDist && d > 1e-6) {
      p[0] = prop.x + (dx / d) * minDist;
      p[2] = prop.z + (dz / d) * minDist;
    }
  }
  // Collide smoothly against Big Lantern poles
  for (const l of engine.lanterns) {
    if (Math.abs(p[1] - l.pos[1]) > 2.2) continue;
    const dx = p[0] - l.pos[0];
    const dz = p[2] - l.pos[2];
    const minDist = 0.42 + playerR;
    const d = Math.hypot(dx, dz);
    if (d < minDist && d > 1e-6) {
      p[0] = l.pos[0] + (dx / d) * minDist;
      p[2] = l.pos[2] + (dz / d) * minDist;
    }
  }
}

let prevJump = false;
function animate(now) {
  requestAnimationFrame(animate);
  const frameDt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  if ((screenMode === 'playing' || screenMode === 'paused') && engine) {
    if (screenMode === 'paused') {
      if (pendingPauseToggle) handleEvents(engine.step(readLiveInput(frameDt)));
    } else {
      accumulator += frameDt;
      const liveInput = readLiveInput(frameDt);
      if (liveInput.jump && !prevJump && engine.player.grounded) sfx.playJump();
      prevJump = liveInput.jump;
      while (accumulator >= DT && (engine.state === 'playing' || engine.state === 'paused')) {
        capturePrevState();
        handleEvents(engine.step(liveInput));
        resolveClientPropCollisions();
        accumulator -= DT;
        if (engine.state === 'paused') break;
      }
      syncViews(frameDt, Math.min(1, accumulator / DT));
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

if (IS_BENCH) {
  runBenchmarkMode();
} else {
  showMainMenu();
  requestAnimationFrame(animate);
}
