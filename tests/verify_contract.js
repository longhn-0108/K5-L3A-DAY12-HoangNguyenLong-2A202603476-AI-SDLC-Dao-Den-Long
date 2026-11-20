import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-v12-verify-'));
const contract = JSON.parse(fs.readFileSync('game.contract.json', 'utf8'));
const [cmd, ...baseArgs] = contract.headless_cmd.split(' ');

function execHeadless(args) {
  const t0 = performance.now();
  const res = spawnSync(cmd, [...baseArgs, ...args], { encoding: 'utf8' });
  const ms = Math.round((performance.now() - t0) * 100) / 100;
  return { ...res, ms };
}

function readJsonl(filePath) {
  return fs.readFileSync(filePath, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
}

const checks = [];

// 1. Determinism (Night 1)
{
  const a = path.join(tmpDir, 'd1.jsonl');
  const b = path.join(tmpDir, 'd2.jsonl');
  const rA = execHeadless(['--seed', '777', '--night', '1', '--ticks', '600', '--out', a]);
  const rB = execHeadless(['--seed', '777', '--night', '1', '--ticks', '600', '--out', b]);
  const pass = rA.status === 0 && rB.status === 0 && fs.readFileSync(a, 'utf8') === fs.readFileSync(b, 'utf8');
  checks.push({ name: 'Determinism (seed=777, 600 ticks x2)', pass, detail: `${rA.ms}ms` });
}

// 2. Fuel decay -> lantern_out -> relight (cost 5) + refuel
{
  const sc = path.join(tmpDir, 'fuel_sc.json');
  const inp = path.join(tmpDir, 'fuel_in.json');
  const out = path.join(tmpDir, 'fuel_out.jsonl');
  fs.writeFileSync(sc, JSON.stringify({
    player: { pos: [0, 0, 0], carried: 10, flames: 3 },
    random_motes: false,
    random_shades: false,
    lanterns: [{ id: 'L1', pos: [0, 0, 1.5], lit: true, fuel: 1.0 }],
    time_left_s: 120,
  }));
  fs.writeFileSync(inp, JSON.stringify({
    frames: [
      { tick: 65, interact: true }, // relight L1 after lantern_out
      { tick: 66, interact: false },
      { tick: 125, interact: true }, // refuel L1
      { tick: 126, interact: false },
    ],
  }));
  const r = execHeadless(['--seed', '1', '--night', '1', '--scenario', sc, '--inputs', inp, '--ticks', '140', '--out', out]);
  const lines = readJsonl(out);
  const evs = lines.filter((l) => l.type === 'event');
  const hasOut = evs.some((e) => e.name === 'lantern_out');
  const hasRelight = evs.some((e) => e.name === 'lantern_lit' && e.data.relight === true);
  const hasRefuel = evs.some((e) => e.name === 'refuel');
  checks.push({ name: 'Fuel decay -> lantern_out -> relight -> refuel', pass: r.status === 0 && hasOut && hasRelight && hasRefuel, detail: `out=${hasOut}, relight=${hasRelight}, refuel=${hasRefuel}` });
}

// 3. Shade drain (<30 fuel) -> fuel_drain event (60 ticks) + Pulse bonus (+15)
{
  const sc1 = path.join(tmpDir, 'drain_sc.json');
  const out1 = path.join(tmpDir, 'drain_out.jsonl');
  fs.writeFileSync(sc1, JSON.stringify({
    player: { pos: [1.5, 0, 14], carried: 5, flames: 3 },
    random_motes: false,
    random_shades: false,
    lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel: 25 }],
    shades: [{ id: 'S1', pos: [1.5, 1, 0], state: 'wander' }],
    time_left_s: 120,
  }));
  const r1 = execHeadless(['--seed', '2', '--night', '1', '--scenario', sc1, '--ticks', '70', '--out', out1]);
  const lines1 = readJsonl(out1);
  const drainEv = lines1.find((l) => l.type === 'event' && l.name === 'fuel_drain');

  const sc2 = path.join(tmpDir, 'drain_pulse_sc.json');
  const inp2 = path.join(tmpDir, 'drain_pulse_in.json');
  const out2 = path.join(tmpDir, 'drain_pulse_out.jsonl');
  fs.writeFileSync(sc2, JSON.stringify({
    player: { pos: [1.5, 0, 4], carried: 5, flames: 3 },
    random_motes: false,
    random_shades: false,
    lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel: 25 }],
    shades: [{ id: 'S1', pos: [1.5, 1, 0], state: 'drain', target_lantern_id: 'L1' }],
  }));
  fs.writeFileSync(inp2, JSON.stringify({ frames: [{ tick: 0, pulse: true }, { tick: 1, pulse: false }] }));
  const r2 = execHeadless(['--seed', '2', '--night', '1', '--scenario', sc2, '--inputs', inp2, '--ticks', '5', '--out', out2]);
  const end2 = readJsonl(out2).at(-1);
  checks.push({
    name: 'Shade drain + fuel_drain event + Pulse bonus (+15)',
    pass: r1.status === 0 && r2.status === 0 && Boolean(drainEv) && end2.score === 15,
    detail: `drainFuel=${drainEv?.data?.fuel}, pulseScore=${end2.score}`,
  });
}

// 4. Dawn survived win (3/5 lit on Night 1)
{
  const sc = path.join(tmpDir, 'dawn_sc.json');
  const out = path.join(tmpDir, 'dawn_out.jsonl');
  fs.writeFileSync(sc, JSON.stringify({
    player: { pos: [0, 0, 0], carried: 0, flames: 3 },
    random_motes: false,
    random_shades: false,
    lanterns: [
      { id: 'L1', lit: true, fuel: 60 },
      { id: 'L2', lit: true, fuel: 50 },
      { id: 'L3', lit: true, fuel: 40 },
      { id: 'L4', lit: false },
      { id: 'L5', lit: false },
    ],
    time_left_s: 1.0,
  }));
  const r = execHeadless(['--seed', '3', '--night', '1', '--scenario', sc, '--ticks', '120', '--out', out]);
  const lines = readJsonl(out);
  const go = lines.find((l) => l.type === 'event' && l.name === 'game_over');
  checks.push({ name: 'Dawn survived win (3/5 lit -> dawn_survived)', pass: r.status === 0 && go?.data?.reason === 'dawn_survived', detail: `reason=${go?.data?.reason}, score=${lines[lines.length - 1].score}` });
}

// 5. Night 3 full 18,000-tick (300s) speed check (<= 30s)
{
  const out = path.join(tmpDir, 'n3_full.jsonl');
  const r = execHeadless(['--seed', '99', '--night', '3', '--ticks', '18000', '--out', out, '--snapshot-every', '60']);
  checks.push({ name: 'Night 3 Full 18,000-tick speed (<= 30s)', pass: r.status === 0 && r.ms <= 30000, detail: `${r.ms}ms` });
}

let allPass = true;
console.log('=== Đảo Đèn Lồng · Phase 3 Contract v1.2 Verification ===');
for (const c of checks) {
  console.log(`[${c.pass ? 'PASS' : 'FAIL'}] ${c.name} — ${c.detail}`);
  if (!c.pass) allPass = false;
}

fs.rmSync(tmpDir, { recursive: true, force: true });
process.exit(allPass ? 0 : 1);
