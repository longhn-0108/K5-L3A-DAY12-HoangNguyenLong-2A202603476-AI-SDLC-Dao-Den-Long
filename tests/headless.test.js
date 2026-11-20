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

describe('Headless CLI Test Contract v1.0', () => {
  it('runs a scenario + inputs to win and produces valid JSONL', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-test-'));
    const scenarioPath = path.join(dir, 'scenario.json');
    const inputsPath = path.join(dir, 'inputs.json');
    const outPath = path.join(dir, 'out.jsonl');

    fs.writeFileSync(
      scenarioPath,
      JSON.stringify({
        player: { pos: [0, 0, 0], carried: 4, flames: 3 },
        random_motes: false,
        random_shades: false,
        motes: [[0, 0, 5]],
        shades: [],
        lanterns: [
          { id: 'L1', pos: [0, 0, 7], deposited: 0, lit: false },
          { id: 'L2', lit: true },
          { id: 'L3', lit: true },
          { id: 'L4', lit: true },
          { id: 'L5', lit: true },
        ],
        time_left_s: 300,
      })
    );

    fs.writeFileSync(
      inputsPath,
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
      '--scenario', scenarioPath,
      '--inputs', inputsPath,
      '--ticks', '600',
      '--out', outPath,
      '--snapshot-every', '10',
    ]);

    assert.equal(res.status, 0, res.stderr);
    const lines = fs.readFileSync(outPath, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    assert.equal(lines[0].type, 'snapshot');
    assert.equal(lines[0].tick, 0);
    assert.equal(lines[0].time_left_s, 300);
    assert.equal(lines[0].motes_active, 1);

    const end = lines[lines.length - 1];
    assert.equal(end.type, 'end');
    assert.equal(end.state, 'won');
    assert.equal(end.ticks, 61);

    const eventNames = lines.filter((l) => l.type === 'event').map((l) => l.name);
    assert.deepEqual(eventNames, ['mote_picked', 'deposit', 'lantern_lit', 'game_over']);
  });

  it('is 100% deterministic across two runs with the same seed', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-det-'));
    const out1 = path.join(dir, 'run1.jsonl');
    const out2 = path.join(dir, 'run2.jsonl');

    const r1 = runHeadless(['--seed', '12345', '--night', '1', '--ticks', '300', '--out', out1]);
    const r2 = runHeadless(['--seed', '12345', '--night', '1', '--ticks', '300', '--out', out2]);
    assert.equal(r1.status, 0, r1.stderr);
    assert.equal(r2.status, 0, r2.stderr);

    const c1 = fs.readFileSync(out1, 'utf8');
    const c2 = fs.readFileSync(out2, 'utf8');
    assert.equal(c1, c2);
  });

  it('exits with code 2 on malformed inputs JSON or non-increasing ticks', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-err-'));
    const badJson = path.join(dir, 'bad.json');
    const badTicks = path.join(dir, 'bad_ticks.json');
    const outPath = path.join(dir, 'out.jsonl');

    fs.writeFileSync(badJson, '{ broken json');
    fs.writeFileSync(
      badTicks,
      JSON.stringify({
        frames: [
          { tick: 10, move: [0, 1] },
          { tick: 10, move: [0, 0] },
        ],
      })
    );

    const r1 = runHeadless(['--seed', '1', '--night', '1', '--inputs', badJson, '--ticks', '20', '--out', outPath]);
    assert.equal(r1.status, 2);
    assert.ok(r1.stderr.length > 0);

    const r2 = runHeadless(['--seed', '1', '--night', '1', '--inputs', badTicks, '--ticks', '20', '--out', outPath]);
    assert.equal(r2.status, 2);
    assert.ok(r2.stderr.length > 0);
  });
});
