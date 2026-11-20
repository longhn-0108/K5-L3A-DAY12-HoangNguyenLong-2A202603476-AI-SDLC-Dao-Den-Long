import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-verify-'));
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

// 1. Determinism & 600-tick default night 1 simulation
{
  const outA = path.join(tmpDir, 'det_a.jsonl');
  const outB = path.join(tmpDir, 'det_b.jsonl');
  const rA = execHeadless(['--seed', '777', '--night', '1', '--ticks', '600', '--out', outA]);
  const rB = execHeadless(['--seed', '777', '--night', '1', '--ticks', '600', '--out', outB]);
  const same = rA.status === 0 && rB.status === 0 && fs.readFileSync(outA, 'utf8') === fs.readFileSync(outB, 'utf8');
  checks.push({ name: 'Determinism (seed=777, 600 ticks x2)', pass: same, detail: `exit=${rA.status}, ${rA.ms}ms` });
}

// 2. Full win scenario (mote pickup -> deposit -> lantern_lit -> all_lit)
{
  const sc = path.join(tmpDir, 'win_sc.json');
  const inp = path.join(tmpDir, 'win_in.json');
  const out = path.join(tmpDir, 'win_out.jsonl');
  fs.writeFileSync(sc, JSON.stringify({
    player: { pos: [0, 0, 0], carried: 4, flames: 3 },
    random_motes: false,
    random_shades: false,
    motes: [[0, 0, 3]],
    shades: [],
    lanterns: [
      { id: 'L1', pos: [0, 0, 5], deposited: 0, lit: false },
      { id: 'L2', lit: true },
      { id: 'L3', lit: true },
      { id: 'L4', lit: true },
      { id: 'L5', lit: true },
    ],
    time_left_s: 200,
  }));
  fs.writeFileSync(inp, JSON.stringify({
    frames: [
      { tick: 0, move: [0, 1], cam_yaw_deg: 0 },
      { tick: 45, move: [0, 0], interact: true },
      { tick: 46, interact: false },
    ],
  }));
  const r = execHeadless(['--seed', '1', '--night', '1', '--scenario', sc, '--inputs', inp, '--ticks', '300', '--out', out]);
  const lines = readJsonl(out);
  const end = lines[lines.length - 1];
  const pass = r.status === 0 && end.state === 'won' && end.ticks === 46;
  checks.push({ name: 'Win flow (pickup + deposit + all_lit)', pass, detail: `state=${end.state}, ticks=${end.ticks}, score=${end.score}` });
}

// 3. Pulse stun + push scenario
{
  const sc = path.join(tmpDir, 'pulse_sc.json');
  const inp = path.join(tmpDir, 'pulse_in.json');
  const out = path.join(tmpDir, 'pulse_out.jsonl');
  fs.writeFileSync(sc, JSON.stringify({
    player: { pos: [0, 0, 0], carried: 4, flames: 3 },
    random_motes: false,
    random_shades: false,
    motes: [],
    shades: [{ id: 'S1', pos: [4, 1, 0] }],
  }));
  fs.writeFileSync(inp, JSON.stringify({
    frames: [
      { tick: 0, pulse: true },
      { tick: 1, pulse: false },
    ],
  }));
  const r = execHeadless(['--seed', '1', '--night', '1', '--scenario', sc, '--inputs', inp, '--ticks', '20', '--out', out]);
  const lines = readJsonl(out);
  const pulseEv = lines.find((l) => l.type === 'event' && l.name === 'pulse');
  const snap10 = lines.find((l) => l.type === 'snapshot' && l.tick === 10);
  const pass = r.status === 0 && pulseEv?.data?.stunned_ids?.includes('S1') && snap10?.shades?.[0]?.state === 'stunned';
  checks.push({ name: 'Pulse stun & push (S1 stunned)', pass, detail: `stunned=${JSON.stringify(pulseEv?.data?.stunned_ids)}, pos=${JSON.stringify(snap10?.shades?.[0]?.pos)}` });
}

// 4. Shade hit & no_flames loss
{
  const sc = path.join(tmpDir, 'lose_sc.json');
  const out = path.join(tmpDir, 'lose_out.jsonl');
  fs.writeFileSync(sc, JSON.stringify({
    player: { pos: [0, 0, 0], carried: 6, flames: 1 },
    random_motes: false,
    random_shades: false,
    motes: [],
    shades: [{ id: 'S1', pos: [2, 1, 0] }],
  }));
  const r = execHeadless(['--seed', '1', '--night', '1', '--scenario', sc, '--ticks', '120', '--out', out]);
  const lines = readJsonl(out);
  const hitEv = lines.find((l) => l.type === 'event' && l.name === 'player_hit');
  const end = lines[lines.length - 1];
  const pass = r.status === 0 && hitEv?.data?.dropped === 3 && end.state === 'lost';
  checks.push({ name: 'Shade hit & loss (no_flames, drop 50%)', pass, detail: `dropped=${hitEv?.data?.dropped}, state=${end.state}, ticks=${end.ticks}` });
}

// 5. Invalid inputs exit code 2
{
  const bad = path.join(tmpDir, 'bad.json');
  const out = path.join(tmpDir, 'bad_out.jsonl');
  fs.writeFileSync(bad, JSON.stringify({ frames: [{ tick: 5 }, { tick: 3 }] }));
  const r = execHeadless(['--seed', '1', '--night', '1', '--inputs', bad, '--ticks', '10', '--out', out]);
  checks.push({ name: 'Invalid inputs -> exit code 2', pass: r.status === 2, detail: `exit=${r.status}` });
}

// 6. Full 4800-tick performance benchmark
{
  const out = path.join(tmpDir, 'perf.jsonl');
  const r = execHeadless(['--seed', '99', '--night', '1', '--ticks', '4800', '--out', out]);
  checks.push({ name: 'Headless speed (4800 ticks)', pass: r.status === 0 && r.ms < 5000, detail: `${r.ms}ms` });
}

let allPass = true;
console.log('=== Đảo Đèn Lồng · Phase 1 Contract Verification ===');
for (const c of checks) {
  console.log(`[${c.pass ? 'PASS' : 'FAIL'}] ${c.name} — ${c.detail}`);
  if (!c.pass) allPass = false;
}

fs.rmSync(tmpDir, { recursive: true, force: true });
process.exit(allPass ? 0 : 1);
