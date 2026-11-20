import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  exportLeaderboard,
  loadLeaderboard,
  saveLeaderboardEntry,
  validatePlayerName,
} from '../src/leaderboard.js';

describe('Phase 4: Leaderboard & --export-leaderboard', () => {
  it('validates names (3-12 chars, ASCII + Vietnamese), sorts top 10, tie-breaks earlier first, and exports', () => {
    assert.equal(validatePlayerName('Ab'), false);
    assert.equal(validatePlayerName('Valid_Name1'), true);
    assert.equal(validatePlayerName('Mây_Đèn'), true);
    assert.equal(validatePlayerName('TooLongPlayerName123'), false);

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-lb-'));
    const dbPath = path.join(dir, 'lb.json');
    const expPath = path.join(dir, 'export.json');

    for (let i = 0; i < 12; i++) {
      saveLeaderboardEntry(
        {
          name: `Player_${i}`,
          score: i === 5 ? 500 : i * 50,
          nights_won: i % 4,
          achieved_at: `2026-11-20T16:00:${String(i).padStart(2, '0')}+07:00`,
          seed: 100 + i,
        },
        dbPath
      );
    }
    // Equal score tie-break: earlier achieved_at ranks higher
    saveLeaderboardEntry(
      {
        name: 'EarlyTie',
        score: 500,
        nights_won: 3,
        achieved_at: '2026-11-20T15:00:00+07:00',
        seed: 999,
      },
      dbPath
    );

    const loaded = loadLeaderboard(dbPath);
    assert.equal(loaded.entries.length, 10);
    assert.equal(loaded.entries[0].name, 'Player_11'); // 550
    assert.equal(loaded.entries[1].name, 'EarlyTie');  // 500 (earlier)
    assert.equal(loaded.entries[2].name, 'Player_5');  // 500 (later)

    exportLeaderboard(expPath, dbPath);
    const exported = JSON.parse(fs.readFileSync(expPath, 'utf8'));
    assert.equal(exported.entries.length, 10);
  });

  it('CLI run.js --export-leaderboard exits 0 and writes valid JSON', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-exp-'));
    const out = path.join(dir, 'lb_out.json');
    const r = spawnSync(process.execPath, ['src/run.js', '--export-leaderboard', out], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const data = JSON.parse(fs.readFileSync(out, 'utf8'));
    assert.ok(Array.isArray(data.entries));
  });
});

describe('Phase 4: Soak Test CLI', () => {
  it('runs soak test for 3 nights with 0 crashes and valid report schema', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-soak-'));
    const out = path.join(dir, 'soak.json');
    const r = spawnSync(process.execPath, ['src/soak.js', '--seed', '7', '--nights', '3', '--out', out], {
      encoding: 'utf8',
    });
    assert.equal(r.status, 0, r.stderr);
    const data = JSON.parse(fs.readFileSync(out, 'utf8'));
    assert.equal(data.nights, 3);
    assert.equal(data.crashes, 0);
    assert.equal(data.results.length, 3);
    assert.ok(data.mem_end_mb <= 1.2 * data.mem_start_mb + 25);
  });
});
