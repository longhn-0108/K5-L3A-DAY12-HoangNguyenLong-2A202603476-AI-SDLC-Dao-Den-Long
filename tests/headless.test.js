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

describe('Headless CLI Test Contract v1.2', () => {
  it('emits v1.2 snapshot fields (fuel, ever_lit, relit_count, capacity) and wins with dawn_survived', () => {
    // Updated from v1.1: win now occurs at dawn (dawn_survived) with >= 3/5 lanterns lit.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-v12-'));
    const scPath = path.join(dir, 'sc.json');
    const outPath = path.join(dir, 'out.jsonl');

    fs.writeFileSync(
      scPath,
      JSON.stringify({
        player: { pos: [0, 0, 0], carried: 0, flames: 3, successful_lights: 2 },
        random_motes: false,
        random_shades: false,
        motes: [],
        shades: [],
        lanterns: [
          { id: 'L1', lit: true, fuel: 60 },
          { id: 'L2', lit: true, fuel: 50 },
          { id: 'L3', lit: true, fuel: 40 },
          { id: 'L4', lit: false },
          { id: 'L5', lit: false },
        ],
        time_left_s: 1.0,
      })
    );

    const res = runHeadless([
      '--seed', '42',
      '--night', '1',
      '--scenario', scPath,
      '--ticks', '120',
      '--out', outPath,
    ]);
    assert.equal(res.status, 0, res.stderr);

    const lines = fs.readFileSync(outPath, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    const snap0 = lines[0];
    assert.equal(snap0.player.capacity, 14);
    assert.equal(snap0.lanterns[0].fuel, 60);
    assert.equal(snap0.lanterns[0].ever_lit, true);
    assert.equal(snap0.lanterns[0].relit_count, 0);
    assert.equal(snap0.lanterns[3].fuel, 0);

    const gameOver = lines.find((l) => l.type === 'event' && l.name === 'game_over');
    assert.equal(gameOver.data.result, 'won');
    assert.equal(gameOver.data.reason, 'dawn_survived');
  });

  it('supports Nights 1, 2, 3 and is 100% deterministic', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-det12-'));
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

  it('exits with code 2 on invalid inputs', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-err12-'));
    const bad = path.join(dir, 'bad.json');
    const out = path.join(dir, 'out.jsonl');
    fs.writeFileSync(bad, JSON.stringify({ frames: [{ tick: 5 }, { tick: 3 }] }));
    const r = runHeadless(['--seed', '1', '--night', '1', '--inputs', bad, '--ticks', '10', '--out', out]);
    assert.equal(r.status, 2);
  });
});
