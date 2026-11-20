import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { GameEngine } from '../sim/engine.js';
import { DT, ISLAND_RADIUS, TUNING, distXZ } from '../sim/tuning.js';
import { SoundFX } from './audio.js';

const canvas = document.getElementById('game-canvas');
const hudEl = document.getElementById('hud');
const hudFlames = document.getElementById('hud-flames');
const hudCarried = document.getElementById('hud-carried');
const hudLanterns = document.getElementById('hud-lanterns');
const hudTime = document.getElementById('hud-time');
const hudScore = document.getElementById('hud-score');
const hudPrompt = document.getElementById('hud-prompt');
const hudPulse = document.getElementById('hud-pulse');
const btnMute = document.getElementById('btn-mute');

const overlayEl = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayDesc = document.getElementById('overlay-desc');
const overlayStats = document.getElementById('overlay-stats');
const btnPlay = document.getElementById('btn-play');

const sfx = new SoundFX();

// Renderer — tuned for locked high-FPS smoothness on laptops
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const nightBg = new THREE.Color(0x0f1024);
const warmBg = new THREE.Color(0x281e3b);
scene.background = nightBg.clone();
scene.fog = new THREE.FogExp2(0x111229, 0.008);

// Top-down / isometric 3D camera
const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.5, 260);

// Post-processing: subtle UnrealBloom for dreamy glowing lanterns, fireflies & spectral ghosts
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.48, // strength
  0.55, // radius
  0.76  // threshold (only emissive lights bloom)
);
composer.addPass(bloomPass);

// Balanced twilight lighting
const hemiLight = new THREE.HemisphereLight(0x6e86d8, 0x221d38, 0.75);
scene.add(hemiLight);

const moonLight = new THREE.DirectionalLight(0xc4d6ff, 0.85);
moonLight.position.set(22, 44, 18);
moonLight.castShadow = true;
moonLight.shadow.mapSize.set(1024, 1024);
moonLight.shadow.camera.near = 5;
moonLight.shadow.camera.far = 125;
const dCam = 42;
moonLight.shadow.camera.left = -dCam;
moonLight.shadow.camera.right = dCam;
moonLight.shadow.camera.top = dCam;
moonLight.shadow.camera.bottom = -dCam;
moonLight.shadow.bias = -0.0008;
scene.add(moonLight);

const rimLight = new THREE.DirectionalLight(0xffb470, 0.25);
rimLight.position.set(-28, 22, -24);
scene.add(rimLight);

// Shared geometries (prevents GC stutter during gameplay)
const SHARED = {
  moteOrb: new THREE.SphereGeometry(0.24, 10, 10),
  moteHalo: new THREE.SphereGeometry(0.46, 8, 8),
  dashPuff: new THREE.SphereGeometry(0.2, 6, 6),
  skyLantern: new THREE.CylinderGeometry(0.18, 0.13, 0.38, 6),
  pulseRing: new THREE.RingGeometry(0.5, 0.92, 40),
  ghostHead: new THREE.SphereGeometry(0.46, 12, 12),
  ghostSkirt: new THREE.ConeGeometry(0.76, 1.35, 10, 1, true),
  ghostAura: new THREE.SphereGeometry(0.82, 10, 10),
  ghostEye: new THREE.SphereGeometry(0.09, 8, 8),
  ghostWisp: new THREE.SphereGeometry(0.12, 6, 6),
  ghostRing: new THREE.RingGeometry(0.78, 1.08, 22),
};

// Animated scenery pools
const swayTrees = [];
const cloudPuffs = [];
let mooredBoat = null;
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

function buildWorld() {
  const worldGroup = new THREE.Group();
  const rng = makeVisualRng(2026);

  const cliff = new THREE.Mesh(
    new THREE.CylinderGeometry(ISLAND_RADIUS + 0.6, ISLAND_RADIUS - 4.5, 5.5, 48),
    new THREE.MeshStandardMaterial({ color: 0x35324a, roughness: 0.92 })
  );
  cliff.position.y = -2.9;
  cliff.receiveShadow = true;
  worldGroup.add(cliff);

  const grass = new THREE.Mesh(
    new THREE.CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS + 0.2, 0.5, 48),
    new THREE.MeshStandardMaterial({ color: 0x244642, roughness: 0.9, metalness: 0.04 })
  );
  grass.position.y = -0.25;
  grass.receiveShadow = true;
  worldGroup.add(grass);

  const innerMeadow = new THREE.Mesh(
    new THREE.CircleGeometry(21, 44),
    new THREE.MeshStandardMaterial({ color: 0x2c524b, roughness: 0.9 })
  );
  innerMeadow.rotation.x = -Math.PI / 2;
  innerMeadow.position.y = 0.015;
  innerMeadow.receiveShadow = true;
  worldGroup.add(innerMeadow);

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x55586b, roughness: 0.92 });
  const pathRing = new THREE.Mesh(new THREE.RingGeometry(20.6, 23.4, 48), stoneMat);
  pathRing.rotation.x = -Math.PI / 2;
  pathRing.position.y = 0.025;
  pathRing.receiveShadow = true;
  worldGroup.add(pathRing);

  const plaza = new THREE.Mesh(new THREE.CircleGeometry(4.8, 24), stoneMat);
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0.03;
  plaza.receiveShadow = true;
  worldGroup.add(plaza);

  const plazaInlay = new THREE.Mesh(
    new THREE.RingGeometry(2.6, 3.1, 24),
    new THREE.MeshStandardMaterial({ color: 0xb88c4d, emissive: 0x452a0c, emissiveIntensity: 0.4, roughness: 0.6 })
  );
  plazaInlay.rotation.x = -Math.PI / 2;
  plazaInlay.position.y = 0.036;
  worldGroup.add(plazaInlay);

  const lanternCoords = [];
  for (let i = 0; i < TUNING.lantern_count_night1; i++) {
    const angle = (i * 2 * Math.PI) / TUNING.lantern_count_night1;
    lanternCoords.push([22 * Math.sin(angle), 22 * Math.cos(angle)]);
    const spoke = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 18.5), stoneMat);
    spoke.rotation.x = -Math.PI / 2;
    spoke.rotation.z = -angle;
    spoke.position.set(Math.sin(angle) * 12.2, 0.026, Math.cos(angle) * 12.2);
    spoke.receiveShadow = true;
    worldGroup.add(spoke);
  }

  // Wooden pier ("Đảo Bến") + boat
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6e472d, roughness: 0.88 });
  const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x472e1e, roughness: 0.92 });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.42, 8.5), woodMat);
  pier.position.set(0, 0.12, ISLAND_RADIUS + 2.2);
  pier.receiveShadow = true;
  worldGroup.add(pier);

  const postGeo = new THREE.CylinderGeometry(0.18, 0.2, 1.35, 6);
  for (const px of [-2.2, 2.2]) {
    for (const pz of [ISLAND_RADIUS - 0.5, ISLAND_RADIUS + 3.2, ISLAND_RADIUS + 6.0]) {
      const post = new THREE.Mesh(postGeo, darkWoodMat);
      post.position.set(px, 0.65, pz);
      worldGroup.add(post);
    }
  }

  const dockLamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xffe094, emissive: 0xffa629, emissiveIntensity: 2.5 })
  );
  dockLamp.position.set(2.2, 1.5, ISLAND_RADIUS + 6.0);
  worldGroup.add(dockLamp);

  const boatGroup = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 3.6), woodMat);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(0.95, 1.2, 4), woodMat);
  bow.rotation.x = Math.PI / 2;
  bow.rotation.y = Math.PI / 4;
  bow.position.z = 2.3;
  boatGroup.add(hull, bow);
  boatGroup.position.set(-4.6, -0.4, ISLAND_RADIUS + 5.2);
  boatGroup.rotation.y = 0.25;
  worldGroup.add(boatGroup);
  mooredBoat = boatGroup;

  // Low-poly pines & blossom trees (lightweight shadow budget)
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x523626, roughness: 0.92 });
  const pineMats = [0x1f5246, 0x266352, 0x1a473f].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 })
  );
  const blossomMat = new THREE.MeshStandardMaterial({
    color: 0xd482a6,
    emissive: 0x4d1d36,
    emissiveIntensity: 0.4,
    roughness: 0.72,
  });

  function addTree(x, z, scale, isBlossom) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * scale, 0.34 * scale, 1.8 * scale, 6), trunkMat);
    trunk.position.y = 0.9 * scale;
    g.add(trunk);

    if (isBlossom) {
      const c1 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.45 * scale, 1), blossomMat);
      c1.position.set(0, 2.5 * scale, 0);
      c1.castShadow = true;
      const c2 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.0 * scale, 1), blossomMat);
      c2.position.set(0.8 * scale, 2.2 * scale, 0.4 * scale);
      g.add(c1, c2);
    } else {
      const leafMat = pineMats[Math.floor(rng() * pineMats.length)];
      for (let tier = 0; tier < 3; tier++) {
        const cone = new THREE.Mesh(
          new THREE.ConeGeometry((1.45 - tier * 0.32) * scale, (1.65 - tier * 0.2) * scale, 6),
          leafMat
        );
        cone.position.y = (1.9 + tier * 0.95) * scale;
        if (tier === 0) cone.castShadow = true;
        g.add(cone);
      }
    }
    worldGroup.add(g);
    swayTrees.push({ group: g, phase: rng() * Math.PI * 2 });
  }

  for (let i = 0; i < 30; i++) {
    const isOuter = i < 22;
    const r = isOuter ? 27.5 + rng() * 5.0 : 10.5 + rng() * 7.2;
    const angle = (i / (isOuter ? 22 : 8)) * Math.PI * 2 + (rng() - 0.5) * 0.25;
    const x = Math.sin(angle) * r;
    const z = Math.cos(angle) * r;
    if (Math.abs(x) < 4.5 && z > 25) continue;
    if (lanternCoords.some(([lx, lz]) => Math.hypot(x - lx, z - lz) < 4.8)) continue;
    addTree(x, z, 0.85 + rng() * 0.48, i % 5 === 0);
  }

  // Mossy boulders & glowing mushrooms
  const rockGeo = new THREE.DodecahedronGeometry(0.65, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x4b4e63, roughness: 0.92 });
  const mushCapGeo = new THREE.ConeGeometry(0.28, 0.22, 7);
  const mushStemGeo = new THREE.CylinderGeometry(0.07, 0.1, 0.35, 6);
  const mushCapMat = new THREE.MeshStandardMaterial({
    color: 0x7dfce4,
    emissive: 0x2ee0c0,
    emissiveIntensity: 1.8,
    roughness: 0.3,
  });
  const mushStemMat = new THREE.MeshStandardMaterial({ color: 0xdcd6c8, roughness: 0.8 });

  for (let i = 0; i < 24; i++) {
    const r = 7 + rng() * 25;
    const a = rng() * Math.PI * 2;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (lanternCoords.some(([lx, lz]) => Math.hypot(x - lx, z - lz) < 3.6)) continue;

    if (i % 2 === 0) {
      const rock = new THREE.Mesh(rockGeo, rockMat);
      const s = 0.7 + rng() * 0.75;
      rock.scale.set(s * 1.2, s * 0.65, s);
      rock.position.set(x, 0.2, z);
      rock.rotation.y = rng() * Math.PI;
      worldGroup.add(rock);
    } else {
      for (let m = 0; m < 2; m++) {
        const ms = 0.7 + rng() * 0.45;
        const ox = x + (m === 0 ? 0 : 0.4);
        const oz = z + (m === 0 ? 0 : 0.3);
        const stem = new THREE.Mesh(mushStemGeo, mushStemMat);
        stem.scale.setScalar(ms);
        stem.position.set(ox, 0.18 * ms, oz);
        const cap = new THREE.Mesh(mushCapGeo, mushCapMat);
        cap.scale.setScalar(ms);
        cap.position.set(ox, 0.42 * ms, oz);
        worldGroup.add(stem, cap);
      }
    }
  }

  // Rim fence bollards
  const bollardGeo = new THREE.CylinderGeometry(0.12, 0.15, 0.85, 6);
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    const x = Math.sin(a) * (ISLAND_RADIUS - 0.6);
    const z = Math.cos(a) * (ISLAND_RADIUS - 0.6);
    if (Math.abs(x) < 3.2 && z > 30) continue;
    const bollard = new THREE.Mesh(bollardGeo, darkWoodMat);
    bollard.position.set(x, 0.42, z);
    worldGroup.add(bollard);
  }

  // Atmospheric sea of clouds
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0x3b3a63,
    emissive: 0x191736,
    emissiveIntensity: 0.4,
    roughness: 0.95,
  });
  const cloudGeo = new THREE.DodecahedronGeometry(1, 1);
  for (let i = 0; i < 38; i++) {
    const angle = (i / 38) * Math.PI * 2 + (i % 3) * 0.14;
    const dist = ISLAND_RADIUS + 8 + (i % 4) * 8;
    const puff = new THREE.Mesh(cloudGeo, cloudMat);
    const sx = 6.8 + (i % 4) * 3.2;
    const sy = 2.6 + (i % 3) * 1.1;
    puff.scale.set(sx, sy, sx * 0.85);
    const baseY = -3.8 - (i % 3) * 1.2;
    puff.position.set(Math.cos(angle) * dist, baseY, Math.sin(angle) * dist);
    worldGroup.add(puff);
    cloudPuffs.push({ mesh: puff, baseY, phase: i * 0.5 });
  }

  // Subtle falling silver-indigo night rain
  const rainPos = new Float32Array(RAIN_COUNT * 6);
  for (let i = 0; i < RAIN_COUNT; i++) {
    const rx = (rng() - 0.5) * 76;
    const ry = rng() * 28;
    const rz = (rng() - 0.5) * 76;
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
    new THREE.LineBasicMaterial({ color: 0x9bb8ff, transparent: true, opacity: 0.22 })
  );
  worldGroup.add(rainSystem);

  // Starfield
  const starCount = 320;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = (i * 2.39996) % (Math.PI * 2);
    const phi = Math.acos(0.12 + ((i * 0.618033) % 0.88));
    const r = 135;
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.cos(phi);
    starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  worldGroup.add(
    new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xfff0c7, size: 0.8, transparent: true, opacity: 0.85 }))
  );

  scene.add(worldGroup);
}

// Ninja-style Mây with nón lá, hanging lantern & flowing scarf
function buildPlayerMesh() {
  const root = new THREE.Group();

  const footRing = new THREE.Mesh(
    new THREE.RingGeometry(0.65, 0.84, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd275, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
  );
  footRing.rotation.x = -Math.PI / 2;
  footRing.position.y = 0.05;
  root.add(footRing);

  const rig = new THREE.Group();
  root.add(rig);

  const tunicMat = new THREE.MeshStandardMaterial({ color: 0x2d2a4a, roughness: 0.65 });
  const sashMat = new THREE.MeshStandardMaterial({
    color: 0xe65c3c,
    emissive: 0x52150a,
    emissiveIntensity: 0.4,
    roughness: 0.55,
  });

  const torso = new THREE.Mesh(new THREE.ConeGeometry(0.46, 1.05, 10), tunicMat);
  torso.position.y = 0.72;
  torso.castShadow = true;
  rig.add(torso);

  const sash = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.22, 10), sashMat);
  sash.position.y = 0.68;
  rig.add(sash);

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
    const seg = new THREE.Mesh(new THREE.BoxGeometry(0.24 - i * 0.04, 0.07, 0.46), sashMat);
    seg.position.set(0, 1.18 - i * 0.06, -0.35 - i * 0.38);
    rig.add(seg);
    scarfSegments.push(seg);
  }

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.27, 10, 10),
    new THREE.MeshStandardMaterial({ color: 0xffe4c7, roughness: 0.55 })
  );
  head.position.y = 1.42;
  rig.add(head);

  const hat = new THREE.Mesh(
    new THREE.ConeGeometry(0.86, 0.44, 18),
    new THREE.MeshStandardMaterial({ color: 0xf0d18c, roughness: 0.72 })
  );
  hat.position.y = 1.72;
  hat.castShadow = true;
  rig.add(hat);

  const lanternPivot = new THREE.Group();
  lanternPivot.position.set(0.64, 1.54, 0.16);
  const cord = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.28, 5),
    new THREE.MeshBasicMaterial({ color: 0xa68352 })
  );
  cord.position.y = -0.14;
  const miniLanternMat = new THREE.MeshStandardMaterial({
    color: 0xffe08a,
    emissive: 0xffa624,
    emissiveIntensity: 2.6,
  });
  const miniLantern = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), miniLanternMat);
  miniLantern.position.y = -0.3;
  lanternPivot.add(cord, miniLantern);
  rig.add(lanternPivot);

  const playerLight = new THREE.PointLight(0xffbb4d, 5.2, 18, 1.3);
  playerLight.position.set(0, 2.3, 0);
  root.add(playerLight);

  root.userData = {
    rig,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    scarfSegments,
    lanternPivot,
    miniLanternMat,
    playerLight,
    flipAngle: 0,
    dashCooldown: 0,
    smoothYaw: 0,
  };
  scene.add(root);
  return root;
}

// Dynamic entity pools
const dynamicGroup = new THREE.Group();
scene.add(dynamicGroup);

const lanternViews = new Map();
const moteViews = new Map();
const shadeViews = new Map();
const skyLanterns = [];
const pulseRings = [];
const dashTrails = [];

function createLanternView(l) {
  const g = new THREE.Group();
  g.position.set(l.pos[0], l.pos[1], l.pos[2]);

  const stonePedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(1.15, 1.35, 0.4, 8),
    new THREE.MeshStandardMaterial({ color: 0x676b82, roughness: 0.88 })
  );
  stonePedestal.position.y = 0.2;
  stonePedestal.receiveShadow = true;
  g.add(stonePedestal);

  const poleMat = new THREE.MeshStandardMaterial({ color: 0x5c3f2e, roughness: 0.85 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 2.7, 8), poleMat);
  pole.position.y = 1.7;
  pole.castShadow = true;
  g.add(pole);

  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x8089ad,
    emissive: 0xffa024,
    emissiveIntensity: 0.2,
    roughness: 0.3,
  });
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.56, 1.25, 8), coreMat);
  core.position.y = 3.4;
  g.add(core);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.15, 0.65, 8), poleMat);
  roof.position.y = 4.3;
  g.add(roof);

  const interactRing = new THREE.Mesh(
    new THREE.RingGeometry(TUNING.interact_radius - 0.12, TUNING.interact_radius, 32),
    new THREE.MeshBasicMaterial({ color: 0x9cb4ff, transparent: true, opacity: 0.25, side: THREE.DoubleSide })
  );
  interactRing.rotation.x = -Math.PI / 2;
  interactRing.position.y = 0.045;
  g.add(interactRing);

  const light = new THREE.PointLight(0xffab36, 0, 28, 1.25);
  light.position.y = 3.6;
  g.add(light);

  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffcf6e,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(TUNING.safe_radius - 0.18, TUNING.safe_radius, 40), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  g.add(ring);

  g.userData = { coreMat, light, ringMat, interactRing };
  dynamicGroup.add(g);
  return g;
}

const moteOrbMat = new THREE.MeshStandardMaterial({
  color: 0xfff4b0,
  emissive: 0xffc038,
  emissiveIntensity: 2.8,
  roughness: 0.15,
});
const moteHaloMat = new THREE.MeshBasicMaterial({ color: 0xffd76e, transparent: true, opacity: 0.3 });

function createMoteView(m) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(SHARED.moteOrb, moteOrbMat));
  g.add(new THREE.Mesh(SHARED.moteHalo, moteHaloMat));
  g.position.set(m.pos[0], 0.95, m.pos[2]);
  dynamicGroup.add(g);
  return g;
}

// Ethereal floating Ghost ("Bóng Ma") that shimmers & recoils from warm lantern light
function createShadeView(s) {
  const root = new THREE.Group();
  const rig = new THREE.Group();
  root.add(rig);

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x261442,
    emissive: 0x6f30c4,
    emissiveIntensity: 1.15,
    transparent: true,
    opacity: 0.82,
    roughness: 0.35,
    side: THREE.DoubleSide,
  });

  // Rounded spectral head + billowing translucent ghost sheet
  const head = new THREE.Mesh(SHARED.ghostHead, bodyMat);
  head.position.y = 0.62;
  rig.add(head);

  const skirt = new THREE.Mesh(SHARED.ghostSkirt, bodyMat);
  skirt.position.y = -0.02;
  rig.add(skirt);

  // Soft ghostly ectoplasm aura
  const auraMat = new THREE.MeshBasicMaterial({
    color: 0x9b5cff,
    transparent: true,
    opacity: 0.22,
  });
  const aura = new THREE.Mesh(SHARED.ghostAura, auraMat);
  aura.position.y = 0.35;
  rig.add(aura);

  // Glowing spectral eyes
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x9ef7ff });
  const leftEye = new THREE.Mesh(SHARED.ghostEye, eyeMat);
  leftEye.position.set(-0.16, 0.68, 0.38);
  const rightEye = new THREE.Mesh(SHARED.ghostEye, eyeMat);
  rightEye.position.set(0.16, 0.68, 0.38);
  rig.add(leftEye, rightEye);

  // Orbiting mini soul wisps
  const wispMat = new THREE.MeshBasicMaterial({ color: 0xc28cff, transparent: true, opacity: 0.75 });
  const wisp1 = new THREE.Mesh(SHARED.ghostWisp, wispMat);
  const wisp2 = new THREE.Mesh(SHARED.ghostWisp, wispMat);
  rig.add(wisp1, wisp2);

  // Ground spectral ring
  const shadowRing = new THREE.Mesh(
    SHARED.ghostRing,
    new THREE.MeshBasicMaterial({ color: 0x9c4dff, transparent: true, opacity: 0.42, side: THREE.DoubleSide })
  );
  shadowRing.rotation.x = -Math.PI / 2;
  shadowRing.position.y = -0.92;
  root.add(shadowRing);

  root.position.set(s.pos[0], s.pos[1], s.pos[2]);
  root.userData = { rig, bodyMat, auraMat, eyeMat, wisp1, wisp2 };
  dynamicGroup.add(root);
  return root;
}

function spawnDashPuff(pos) {
  const mat = new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.5 });
  const mesh = new THREE.Mesh(SHARED.dashPuff, mat);
  mesh.position.set(pos[0], Math.max(0.18, pos[1] + 0.18), pos[2]);
  dynamicGroup.add(mesh);
  dashTrails.push({ mesh, mat, age: 0, maxAge: 0.28 });
}

function spawnSkyLanterns(originPos) {
  for (let i = 0; i < 5; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffcc66, transparent: true, opacity: 0.95 });
    const mesh = new THREE.Mesh(SHARED.skyLantern, mat);
    mesh.position.set(
      originPos[0] + (Math.random() - 0.5) * 2.4,
      4.2 + Math.random() * 1.2,
      originPos[2] + (Math.random() - 0.5) * 2.4
    );
    dynamicGroup.add(mesh);
    skyLanterns.push({
      mesh,
      mat,
      vy: 1.6 + Math.random() * 0.9,
      driftX: (Math.random() - 0.5) * 0.45,
      driftZ: (Math.random() - 0.5) * 0.45,
      age: 0,
      maxAge: 7.5,
    });
  }
}

function spawnPulseRing(originPos) {
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffe484,
    transparent: true,
    opacity: 0.92,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(SHARED.pulseRing, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(originPos[0], 0.14, originPos[2]);
  dynamicGroup.add(mesh);
  pulseRings.push({ mesh, mat, age: 0, duration: 0.45 });
}

buildWorld();
const playerMesh = buildPlayerMesh();

// Input state
const keys = new Set();
let camYawDeg = 0;
let camZoom = 1.0;
let dragging = false;
let lastMouseX = 0;

window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'KeyM') {
    const muted = sfx.toggleMute();
    btnMute.textContent = muted ? '🔇' : '🔊';
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));

canvas.addEventListener('mousedown', (e) => {
  if (e.button === 0) {
    dragging = true;
    lastMouseX = e.clientX;
  }
});
window.addEventListener('mouseup', () => {
  dragging = false;
});
window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastMouseX;
  lastMouseX = e.clientX;
  camYawDeg = (camYawDeg - dx * 0.35 + 360) % 360;
});
canvas.addEventListener(
  'wheel',
  (e) => {
    camZoom = Math.min(1.45, Math.max(0.7, camZoom + e.deltaY * 0.0006));
  },
  { passive: true }
);

btnMute.addEventListener('click', () => {
  const muted = sfx.toggleMute();
  btnMute.textContent = muted ? '🔇' : '🔊';
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  bloomPass.setSize(window.innerWidth, window.innerHeight);
});

// Game session + render interpolation snapshots (eliminates 60Hz vs 120/144Hz stutter!)
let engine = null;
let running = false;
let accumulator = 0;
let lastTime = performance.now();
let visualClock = 0;

let prevPlayerPos = [0, 0, 0];
const prevShadePositions = new Map();
const camTargetVec = new THREE.Vector3();

function capturePrevState() {
  if (!engine) return;
  prevPlayerPos = [engine.player.pos[0], engine.player.pos[1], engine.player.pos[2]];
  prevShadePositions.clear();
  for (const s of engine.shades) {
    prevShadePositions.set(s.id, [s.pos[0], s.pos[1], s.pos[2]]);
  }
}

function clearDynamicViews() {
  for (const v of lanternViews.values()) dynamicGroup.remove(v);
  for (const v of moteViews.values()) dynamicGroup.remove(v);
  for (const v of shadeViews.values()) dynamicGroup.remove(v);
  for (const sl of skyLanterns) {
    dynamicGroup.remove(sl.mesh);
    sl.mat.dispose();
  }
  for (const pr of pulseRings) {
    dynamicGroup.remove(pr.mesh);
    pr.mat.dispose();
  }
  for (const dt of dashTrails) {
    dynamicGroup.remove(dt.mesh);
    dt.mat.dispose();
  }
  lanternViews.clear();
  moteViews.clear();
  shadeViews.clear();
  skyLanterns.length = 0;
  pulseRings.length = 0;
  dashTrails.length = 0;
}

function startNewGame() {
  clearDynamicViews();
  const seed = Math.floor(Math.random() * 100000) + 1;
  engine = new GameEngine({ seed, night: 1 });
  camYawDeg = 0;
  camZoom = 1.0;
  accumulator = 0;
  running = true;
  capturePrevState();

  for (const l of engine.lanterns) {
    lanternViews.set(l.id, createLanternView(l));
  }

  overlayEl.classList.add('hidden');
  hudEl.classList.remove('hidden');
  syncViews(0, 1);
  updateHUD();
}

btnPlay.addEventListener('click', startNewGame);

function showEndScreen(result, reason) {
  running = false;
  overlayEl.classList.remove('hidden');
  overlayStats.classList.remove('hidden');

  const litCount = engine.lanterns.filter((l) => l.lit).length;
  if (result === 'won') {
    overlayTitle.textContent = 'Đảo Bến Đã Sáng Trở Lại!';
    overlayDesc.textContent = 'Mây đã thắp sáng toàn bộ 5 Đèn Lồng Lớn và đẩy lùi bóng ma khỏi hòn đảo.';
    sfx.playWin();
  } else {
    overlayTitle.textContent = reason === 'dawn' ? 'Bình Minh Đã Lên...' : 'Ngọn Lửa Đã Tắt...';
    overlayDesc.textContent =
      reason === 'dawn'
        ? 'Hết thời gian của Đêm 1 trước khi tất cả Đèn Lồng Lớn được thắp sáng.'
        : 'Các bóng ma đã làm tắt hết ngọn lửa của Mây. Hãy thử lại nhé!';
    sfx.playLose();
  }

  overlayStats.innerHTML = `
    <div class="stat-box"><div class="k">Điểm</div><div class="v">${engine.score}</div></div>
    <div class="stat-box"><div class="k">Đèn đã thắp</div><div class="v">${litCount} / ${engine.lanterns.length}</div></div>
    <div class="stat-box"><div class="k">Thời gian còn</div><div class="v">${Math.ceil(engine.getTimeLeftS())}s</div></div>
  `;
  btnPlay.textContent = 'Chơi lại Đêm 1';
}

function handleEvents(events) {
  for (const ev of events) {
    if (ev.name === 'mote_picked') {
      sfx.playPickup(ev.data.carried);
    } else if (ev.name === 'deposit') {
      sfx.playDeposit();
    } else if (ev.name === 'lantern_lit') {
      sfx.playLanternLit();
      const l = engine.lanterns.find((x) => x.id === ev.data.lantern_id);
      if (l) spawnSkyLanterns(l.pos);
    } else if (ev.name === 'pulse') {
      sfx.playPulse();
      spawnPulseRing(engine.player.pos);
    } else if (ev.name === 'player_hit') {
      sfx.playHit();
    } else if (ev.name === 'game_over') {
      showEndScreen(ev.data.result, ev.data.reason);
    }
  }
}

function readLiveInput(dtVisual) {
  const rotSpeed = 125 * dtVisual;
  if (keys.has('ArrowLeft') || keys.has('KeyQ')) camYawDeg = (camYawDeg + rotSpeed) % 360;
  if (keys.has('ArrowRight')) camYawDeg = (camYawDeg - rotSpeed + 360) % 360;

  let mx = 0;
  let mz = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) mz -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) mz += 1;
  if (keys.has('KeyA')) mx -= 1;
  if (keys.has('KeyD')) mx += 1;

  return {
    move: [mx, mz],
    cam_yaw_deg: camYawDeg,
    jump: keys.has('Space'),
    interact: keys.has('KeyE') || keys.has('KeyF'),
    pulse: keys.has('KeyR'),
  };
}

function animateScenery(dtVisual) {
  visualClock += dtVisual;
  for (const t of swayTrees) {
    t.group.rotation.z = Math.sin(visualClock * 1.4 + t.phase) * 0.032;
  }
  for (const c of cloudPuffs) {
    c.mesh.position.y = c.baseY + Math.sin(visualClock * 0.7 + c.phase) * 0.35;
  }
  if (mooredBoat) {
    mooredBoat.position.y = -0.35 + Math.sin(visualClock * 1.8) * 0.14;
    mooredBoat.rotation.z = Math.sin(visualClock * 1.3) * 0.05;
  }
  if (rainSystem && dtVisual > 0) {
    const posAttr = rainSystem.geometry.attributes.position;
    const arr = posAttr.array;
    const fall = 21 * dtVisual;
    for (let i = 0; i < RAIN_COUNT; i++) {
      let y1 = arr[i * 6 + 1] - fall;
      if (y1 < 0) y1 += 28;
      arr[i * 6 + 1] = y1;
      arr[i * 6 + 4] = y1 - 1.25;
    }
    posAttr.needsUpdate = true;
  }
}

function lerpAngle(a, b, t) {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

function syncViews(dtVisual, alpha) {
  if (!engine) return;
  animateScenery(dtVisual);

  // Smooth interpolated player position (eliminates 60Hz tick jitter)
  const p = engine.player;
  const ud = playerMesh.userData;
  const px = prevPlayerPos[0] + (p.pos[0] - prevPlayerPos[0]) * alpha;
  const py = prevPlayerPos[1] + (p.pos[1] - prevPlayerPos[1]) * alpha;
  const pz = prevPlayerPos[2] + (p.pos[2] - prevPlayerPos[2]) * alpha;

  const stepMove = Math.hypot(p.pos[0] - prevPlayerPos[0], p.pos[2] - prevPlayerPos[2]);
  const isMoving = stepMove > 0.01;
  const isAirborne = py > 0.05;

  const bob = !isAirborne ? Math.abs(Math.sin(visualClock * (isMoving ? 14 : 4))) * (isMoving ? 0.07 : 0.02) : 0;
  playerMesh.position.set(px, py + bob, pz);
  const damp = 1 - Math.exp(-16 * dtVisual);
  ud.smoothYaw = lerpAngle(ud.smoothYaw, p.facingYaw, dtVisual > 0 ? damp : 1);
  playerMesh.rotation.y = ud.smoothYaw;
  playerMesh.visible = p.invulnTimer <= 0 || Math.floor(visualClock * 16) % 2 === 0;

  if (isAirborne) {
    ud.flipAngle += dtVisual * 12.5;
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
    seg.rotation.x = isMoving ? 0.15 + idx * 0.08 : -0.25 - idx * 0.1;
  });
  ud.lanternPivot.rotation.x = isMoving ? -0.45 + Math.sin(visualClock * 12) * 0.12 : Math.sin(visualClock * 3) * 0.08;

  ud.dashCooldown -= dtVisual;
  if (isMoving && !isAirborne && ud.dashCooldown <= 0) {
    spawnDashPuff([px, py, pz]);
    ud.dashCooldown = 0.095;
  }

  const carryRatio = p.carried / TUNING.carry_capacity;
  ud.playerLight.intensity = 4.0 + carryRatio * 4.2;
  ud.miniLanternMat.emissiveIntensity = 2.0 + carryRatio * 2.4;

  // Lanterns & ambient progression
  let litCount = 0;
  for (const l of engine.lanterns) {
    if (l.lit) litCount += 1;
    const v = lanternViews.get(l.id);
    if (!v) continue;
    const progress = l.deposited / TUNING.lantern_cost;
    if (l.lit) {
      v.userData.coreMat.color.setHex(0xffe699);
      v.userData.coreMat.emissiveIntensity = 3.0 + Math.sin(visualClock * 3 + l.pos[0]) * 0.25;
      v.userData.light.intensity = 24;
      v.userData.ringMat.opacity = 0.32;
      v.userData.interactRing.visible = false;
    } else {
      v.userData.coreMat.color.setHex(0x8089ad);
      v.userData.coreMat.emissiveIntensity = 0.2 + progress * 1.4;
      v.userData.light.intensity = progress > 0 ? 1.5 + progress * 6 : 0;
      v.userData.ringMat.opacity = 0;
      v.userData.interactRing.visible = true;
    }
  }

  const warmth = litCount / engine.lanterns.length;
  scene.background.copy(nightBg).lerp(warmBg, warmth);
  scene.fog.color.copy(scene.background);
  hemiLight.intensity = 0.75 + warmth * 0.7;
  hemiLight.color.setHex(0x6e86d8).lerp(new THREE.Color(0xffcf94), warmth * 0.65);
  moonLight.intensity = 0.85 + warmth * 0.38;

  // Motes sync
  const activeMoteIds = new Set(engine.motes.map((m) => m.id));
  for (const [id, mesh] of moteViews.entries()) {
    if (!activeMoteIds.has(id)) {
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
    mesh.position.set(m.pos[0], 0.9 + Math.sin(visualClock * 3.8 + m.pos[0] * 0.7) * 0.25, m.pos[2]);
  }

  // Ghosts (Bóng Ma) sync with smooth interpolation
  const activeShadeIds = new Set(engine.shades.map((s) => s.id));
  for (const [id, mesh] of shadeViews.entries()) {
    if (!activeShadeIds.has(id)) {
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

    const nearLit = engine.lanterns.some(
      (l) => l.lit && distXZ(s.pos, l.pos) <= TUNING.safe_radius + 1.4
    );
    const floatY = sy + Math.sin(visualClock * 3.6 + s.pos[2]) * 0.22;
    mesh.position.set(sx, floatY, sz);
    mesh.lookAt(px, floatY, pz);

    const { rig, bodyMat, auraMat, wisp1, wisp2 } = mesh.userData;
    const wAngle = visualClock * 3.2 + sx;
    wisp1.position.set(Math.cos(wAngle) * 0.75, 0.25 + Math.sin(wAngle * 1.5) * 0.2, Math.sin(wAngle) * 0.75);
    wisp2.position.set(Math.cos(wAngle + Math.PI) * 0.75, 0.45 - Math.sin(wAngle * 1.5) * 0.2, Math.sin(wAngle + Math.PI) * 0.75);

    if (s.state === 'stunned') {
      bodyMat.emissive.setHex(0xd4b8ff);
      bodyMat.opacity = 0.45 + Math.sin(visualClock * 24) * 0.2;
      auraMat.opacity = 0.1;
      rig.scale.setScalar(0.76);
      rig.rotation.x = -0.35;
      rig.rotation.z = Math.sin(visualClock * 22) * 0.28;
    } else if (nearLit) {
      bodyMat.emissive.setHex(0xa86bff);
      bodyMat.opacity = 0.62;
      auraMat.opacity = 0.16;
      rig.scale.setScalar(0.9);
      rig.rotation.x = -0.22;
      rig.rotation.z = Math.sin(visualClock * 14) * 0.14;
    } else {
      bodyMat.emissive.setHex(0x6f30c4);
      bodyMat.opacity = 0.84;
      auraMat.opacity = 0.24;
      rig.scale.setScalar(1.0);
      rig.rotation.x = 0.2;
      rig.rotation.z = Math.sin(visualClock * 4.5) * 0.08;
    }
  }

  // Temporary particle pools (dispose materials cleanly)
  for (let i = dashTrails.length - 1; i >= 0; i--) {
    const d = dashTrails[i];
    d.age += dtVisual;
    const t = d.age / d.maxAge;
    d.mesh.scale.setScalar(1 + t * 1.3);
    d.mesh.position.y += dtVisual * 0.55;
    d.mat.opacity = Math.max(0, (1 - t) * 0.5);
    if (d.age >= d.maxAge) {
      dynamicGroup.remove(d.mesh);
      d.mat.dispose();
      dashTrails.splice(i, 1);
    }
  }

  for (let i = skyLanterns.length - 1; i >= 0; i--) {
    const sl = skyLanterns[i];
    sl.age += dtVisual;
    sl.mesh.position.y += sl.vy * dtVisual;
    sl.mesh.position.x += sl.driftX * dtVisual;
    sl.mesh.position.z += sl.driftZ * dtVisual;
    sl.mat.opacity = Math.max(0, 1 - sl.age / sl.maxAge);
    if (sl.age >= sl.maxAge) {
      dynamicGroup.remove(sl.mesh);
      sl.mat.dispose();
      skyLanterns.splice(i, 1);
    }
  }

  for (let i = pulseRings.length - 1; i >= 0; i--) {
    const pr = pulseRings[i];
    pr.age += dtVisual;
    const t = Math.min(1, pr.age / pr.duration);
    pr.mesh.scale.setScalar(1 + t * (TUNING.pulse_radius / 0.92));
    pr.mat.opacity = (1 - t) * 0.92;
    if (pr.age >= pr.duration) {
      dynamicGroup.remove(pr.mesh);
      pr.mat.dispose();
      pulseRings.splice(i, 1);
    }
  }

  // Frame-rate independent smooth top-down camera
  const theta = (camYawDeg * Math.PI) / 180;
  const camDist = 14.5 * camZoom;
  const camHeight = 22.0 * camZoom;
  camTargetVec.set(px + Math.sin(theta) * camDist, py + camHeight, pz + Math.cos(theta) * camDist);
  const camAlpha = dtVisual > 0 ? 1 - Math.exp(-9 * dtVisual) : 1;
  camera.position.lerp(camTargetVec, camAlpha);
  camera.lookAt(px, py + 0.6, pz);
}

function updateHUD() {
  if (!engine) return;
  const p = engine.player;
  hudFlames.textContent = p.flames > 0 ? '🔥'.repeat(p.flames) : '💨';
  hudCarried.textContent = `${p.carried} / ${TUNING.carry_capacity}`;
  const litCount = engine.lanterns.filter((l) => l.lit).length;
  hudLanterns.textContent = `${litCount} / ${engine.lanterns.length}`;

  const sec = Math.ceil(engine.getTimeLeftS());
  const mm = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');
  hudTime.textContent = `${mm}:${ss}`;
  hudScore.textContent = String(engine.score);

  if (p.pulseCooldown > 0) {
    hudPulse.textContent = `Tỏa sáng · Hồi chiêu ${p.pulseCooldown.toFixed(1)}s`;
    hudPulse.classList.add('cooldown');
  } else if (p.carried < TUNING.pulse_cost) {
    hudPulse.textContent = `Tỏa sáng [R] · Cần ${TUNING.pulse_cost} đom đóm`;
    hudPulse.classList.add('cooldown');
  } else {
    hudPulse.textContent = `Tỏa sáng [R] · Tốn ${TUNING.pulse_cost} ✨ · Sẵn sàng`;
    hudPulse.classList.remove('cooldown');
  }

  const nearLantern = engine.lanterns.find(
    (l) => !l.lit && distXZ(p.pos, l.pos) <= TUNING.interact_radius
  );
  if (nearLantern && p.carried > 0) {
    hudPrompt.textContent = `Nhấn [E] / [F] để nạp sáng vào ${nearLantern.id} (${nearLantern.deposited}/${TUNING.lantern_cost})`;
    hudPrompt.classList.remove('hidden');
  } else if (nearLantern) {
    hudPrompt.textContent = `${nearLantern.id}: cần thêm ${TUNING.lantern_cost - nearLantern.deposited} đom đóm`;
    hudPrompt.classList.remove('hidden');
  } else {
    hudPrompt.classList.add('hidden');
  }
}

function animate(now) {
  requestAnimationFrame(animate);
  const frameDt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  if (running && engine && engine.state === 'playing') {
    accumulator += frameDt;
    const liveInput = readLiveInput(frameDt);
    while (accumulator >= DT && engine.state === 'playing') {
      capturePrevState();
      const events = engine.step(liveInput);
      handleEvents(events);
      accumulator -= DT;
    }
    const alpha = Math.min(1, accumulator / DT);
    syncViews(frameDt, alpha);
    updateHUD();
  } else {
    animateScenery(frameDt);
    const t = now * 0.00022;
    camera.position.set(Math.sin(t) * 32, 26, Math.cos(t) * 32);
    camera.lookAt(0, 0.5, 0);
  }

  composer.render();
}

requestAnimationFrame(animate);
