import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function runHeadless(args) {
  return spawnSync(process.execPath, ['src/headless.js', ...args], {
    encoding: 'utf8',
  });
}

describe('Headless CLI Test Contract v1.1 (Nights 1-3)', () => {
  it('runs Night 1 scenario + inputs to win and emits valid v1.1 snapshot schema', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-v11-'));
    const scPath = path.join(dir, 'sc.json');
    const inPath = path.join(dir, 'in.json');
    const outPath = path.join(dir, 'out.jsonl');

    fs.writeFileSync(
      scPath,
      JSON.stringify({
        player: { pos: [0, 0, 0], carried: 9, flames: 3 },
        random_motes: false,
        random_shades: false,
        motes: [[0, 0, 4]],
        shades: [],
        lanterns: [
          { id: 'L1', pos: [0, 0, 6], deposited: 0, lit: false },
          { id: 'L2', lit: true },
          { id: 'L3', lit: true },
          { id: 'L4', lit: true },
          { id: 'L5', lit: true },
        ],
        time_left_s: 300,
      })
    );
    fs.writeFileSync(
      inPath,
      JSON.stringify({
        frames: [
          { tick: 0, move: [0, 1], cam_yaw_deg: 0 },
          { tick: 60, move: [0, 0], interact: true },
          { tick: 61, interact: false },
        ],
      })
    );

    const res = runHeadless([
      '--seed', '42',
      '--night', '1',
      '--scenario', scPath,
      '--inputs', inPath,
      '--ticks', '600',
      '--out', outPath,
    ]);
    assert.equal(res.status, 0, res.stderr);

    const lines = fs.readFileSync(outPath, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    const snap0 = lines[0];
    assert.equal(snap0.night, 1);
    assert.ok('wind' in snap0 && typeof snap0.wind.active === 'boolean');
    assert.ok('vel' in snap0.player && 'grounded' in snap0.player && 'dash_cd_s' in snap0.player);
    assert.ok(Array.isArray(snap0.motes) && Array.isArray(snap0.drifters) && Array.isArray(snap0.charms));

    const end = lines[lines.length - 1];
    assert.equal(end.type, 'end');
    assert.equal(end.state, 'won');
    assert.equal(end.ticks, 61);
  });

  it('supports Nights 1, 2, 3 and is 100% deterministic', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-det-'));
    for (const night of ['1', '2', '3']) {
      const o1 = path.join(dir, `n${night}_1.jsonl`);
      const o2 = path.join(dir, `n${night}_2.jsonl`);
      const r1 = runHeadless(['--seed', '777', '--night', night, '--ticks', '400', '--out', o1]);
      const r2 = runHeadless(['--seed', '777', '--night', night, '--ticks', '400', '--out', o2]);
      assert.equal(r1.status, 0, r1.stderr);
      assert.equal(r2.status, 0, r2.stderr);
      assert.equal(fs.readFileSync(o1, 'utf8'), fs.readFileSync(o2, 'utf8'));
    }
  });

  it('exits with code 2 on malformed JSON or non-increasing ticks', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-err-'));
    const bad = path.join(dir, 'bad.json');
    const out = path.join(dir, 'out.jsonl');
    fs.writeFileSync(bad, JSON.stringify({ frames: [{ tick: 5 }, { tick: 5 }] }));
    const r = runHeadless(['--seed', '1', '--night', '1', '--inputs', bad, '--ticks', '10', '--out', out]);
    assert.equal(r.status, 2);
  });
});
