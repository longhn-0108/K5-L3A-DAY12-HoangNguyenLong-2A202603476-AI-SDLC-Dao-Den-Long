import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-v11-verify-'));
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

// 1. Night 1 Determinism
{
  const a = path.join(tmpDir, 'd1.jsonl');
  const b = path.join(tmpDir, 'd2.jsonl');
  const rA = execHeadless(['--seed', '777', '--night', '1', '--ticks', '600', '--out', a]);
  const rB = execHeadless(['--seed', '777', '--night', '1', '--ticks', '600', '--out', b]);
  const pass = rA.status === 0 && rB.status === 0 && fs.readFileSync(a, 'utf8') === fs.readFileSync(b, 'utf8');
  checks.push({ name: 'Night 1 Determinism (600 ticks x2)', pass, detail: `${rA.ms}ms` });
}

// 2. Dash + Pause/Resume scenario
{
  const sc = path.join(tmpDir, 'dash_sc.json');
  const inp = path.join(tmpDir, 'dash_in.json');
  const out = path.join(tmpDir, 'dash_out.jsonl');
  fs.writeFileSync(sc, JSON.stringify({ random_motes: false, random_shades: false }));
  fs.writeFileSync(inp, JSON.stringify({
    frames: [
      { tick: 0, move: [0, 1], dash: true },
      { tick: 1, dash: false },
      { tick: 15, pause: true },
      { tick: 16, pause: false },
      { tick: 25, pause: true },
      { tick: 26, pause: false },
    ],
  }));
  const r = execHeadless(['--seed', '1', '--night', '1', '--scenario', sc, '--inputs', inp, '--ticks', '40', '--out', out, '--snapshot-every', '20']);
  const lines = readJsonl(out);
  const evNames = lines.filter((l) => l.type === 'event').map((l) => l.name);
  const snap20 = lines.find((l) => l.type === 'snapshot' && l.tick === 20);
  const pass = r.status === 0 && evNames.includes('dash') && evNames.includes('paused') && evNames.includes('resumed') && snap20?.state === 'paused';
  checks.push({ name: 'Dash + Pause/Resume freeze', pass, detail: `events=${JSON.stringify(evNames)}, snap20.state=${snap20?.state}` });
}

// 3. Night 2 Jump Pad + Wind Charm + Drifter steal/drop
{
  const sc = path.join(tmpDir, 'n2_sc.json');
  const inp = path.join(tmpDir, 'n2_in.json');
  const out = path.join(tmpDir, 'n2_out.jsonl');
  fs.writeFileSync(sc, JSON.stringify({
    player: { pos: [35, 0, 0], carried: 6, flames: 3 },
    random_motes: false,
    random_shades: false,
    random_drifters: false,
    drifters: [{ id: 'D1', pos: [35.5, 1.5, 0], state: 'chase' }],
  }));
  fs.writeFileSync(inp, JSON.stringify({
    frames: [
      { tick: 1, pulse: true },
      { tick: 2, pulse: false },
    ],
  }));
  const r = execHeadless(['--seed', '2', '--night', '2', '--scenario', sc, '--inputs', inp, '--ticks', '20', '--out', out]);
  const lines = readJsonl(out);
  const evNames = lines.filter((l) => l.type === 'event').map((l) => l.name);
  const pass = r.status === 0 && evNames.includes('charm_picked') && evNames.includes('drifter_steal') && evNames.includes('drifter_drop');
  checks.push({ name: 'Night 2 Charm + Drifter steal & pulse drop', pass, detail: `events=${JSON.stringify(evNames)}` });
}

// 4. Night 2 Jump Pad A -> B
{
  const sc = path.join(tmpDir, 'pad_sc.json');
  const out = path.join(tmpDir, 'pad_out.jsonl');
  fs.writeFileSync(sc, JSON.stringify({
    player: { pos: [20, 0, 18], carried: 0, flames: 3 },
    random_motes: false,
    random_shades: false,
    random_drifters: false,
  }));
  const r = execHeadless(['--seed', '3', '--night', '2', '--scenario', sc, '--ticks', '100', '--out', out, '--snapshot-every', '100']);
  const lines = readJsonl(out);
  const snap100 = lines.find((l) => l.type === 'snapshot' && l.tick === 100);
  const distB = Math.hypot(snap100.player.pos[0] - 70, snap100.player.pos[2]);
  const pass = r.status === 0 && snap100.player.grounded && distB <= 28;
  checks.push({ name: 'Night 2 Jump Pad launch (Island A -> B)', pass, detail: `pos=${JSON.stringify(snap100.player.pos)}, distB=${distB.toFixed(1)}m` });
}

// 5. Night 3 Wind + Full 21,600-tick performance benchmark (<= 30s)
{
  const out = path.join(tmpDir, 'n3_full.jsonl');
  const r = execHeadless(['--seed', '99', '--night', '3', '--ticks', '21600', '--out', out, '--snapshot-every', '60']);
  const lines = readJsonl(out);
  const windActiveSeen = lines.some((l) => l.type === 'snapshot' && l.wind?.active === true);
  const pass = r.status === 0 && r.ms <= 30000 && windActiveSeen;
  checks.push({ name: 'Night 3 Wind + Full 21,600-tick speed (<= 30s)', pass, detail: `${r.ms}ms, windActive=${windActiveSeen}` });
}

// 6. Fall off island -> player_hit { by: "fall", lost }
{
  const sc = path.join(tmpDir, 'fall_sc.json');
  const out = path.join(tmpDir, 'fall_out.jsonl');
  fs.writeFileSync(sc, JSON.stringify({
    player: { pos: [41, -9.5, 0], carried: 5, flames: 2 },
    random_motes: false,
    random_shades: false,
  }));
  const r = execHeadless(['--seed', '4', '--night', '1', '--scenario', sc, '--ticks', '80', '--out', out, '--snapshot-every', '80']);
  const lines = readJsonl(out);
  const hit = lines.find((l) => l.type === 'event' && l.name === 'player_hit');
  const snap80 = lines.find((l) => l.type === 'snapshot' && l.tick === 80);
  const pass = r.status === 0 && hit?.data?.by === 'fall' && hit?.data?.lost === 5 && snap80?.player?.pos[0] === 0;
  checks.push({ name: 'Fall off island + respawn at (0,0,0)', pass, detail: `lost=${hit?.data?.lost}, respawnPos=${JSON.stringify(snap80?.player?.pos)}` });
}

let allPass = true;
console.log('=== Đảo Đèn Lồng · Phase 2 Contract v1.1 Verification ===');
for (const c of checks) {
  console.log(`[${c.pass ? 'PASS' : 'FAIL'}] ${c.name} — ${c.detail}`);
  if (!c.pass) allPass = false;
}

fs.rmSync(tmpDir, { recursive: true, force: true });
process.exit(allPass ? 0 : 1);
