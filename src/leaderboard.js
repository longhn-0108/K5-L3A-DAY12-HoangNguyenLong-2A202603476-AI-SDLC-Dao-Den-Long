import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const LEADERBOARD_FILE = path.join(os.homedir(), '.dao-den-long-leaderboard.json');

// Supports 3-12 chars: A-Z, a-z, 0-9, _, plus Vietnamese accented letters
const NAME_REGEX = /^[\p{L}0-9_]{3,12}$/u;

export function validatePlayerName(name) {
  return typeof name === 'string' && NAME_REGEX.test(name.trim());
}

export function formatIsoWithTimezone(date = new Date()) {
  const pad = (n) => String(Math.floor(Math.abs(n))).padStart(2, '0');
  const offMin = -date.getTimezoneOffset();
  const sign = offMin >= 0 ? '+' : '-';
  const hh = pad(offMin / 60);
  const mm = pad(offMin % 60);
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${hh}:${mm}`
  );
}

export function sortEntries(entries) {
  return [...entries]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return String(a.achieved_at).localeCompare(String(b.achieved_at));
    })
    .slice(0, 10);
}

export function loadLeaderboard(filePath = LEADERBOARD_FILE) {
  try {
    if (!fs.existsSync(filePath)) return { entries: [] };
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!Array.isArray(data.entries)) return { entries: [] };
    return { entries: sortEntries(data.entries) };
  } catch {
    return { entries: [] };
  }
}

export function saveLeaderboardEntry(entry, filePath = LEADERBOARD_FILE) {
  const name = String(entry.name || '').trim();
  if (!validatePlayerName(name)) {
    throw new Error('Tên phải dài 3–12 ký tự (chữ, số hoặc dấu _)');
  }
  const board = loadLeaderboard(filePath);
  const record = {
    name,
    score: Math.max(0, Math.floor(Number(entry.score) || 0)),
    nights_won: Math.max(0, Math.min(3, Math.floor(Number(entry.nights_won) || 0))),
    achieved_at: entry.achieved_at || formatIsoWithTimezone(new Date()),
    seed: Number.isInteger(entry.seed) ? entry.seed : 1,
  };
  const entries = sortEntries([...board.entries, record]);
  const out = { entries };
  fs.writeFileSync(filePath, JSON.stringify(out, null, 2) + '\n', 'utf8');
  return out;
}

export function exportLeaderboard(outPath, filePath = LEADERBOARD_FILE) {
  const board = loadLeaderboard(filePath);
  const resolved = path.resolve(outPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, JSON.stringify(board, null, 2) + '\n', 'utf8');
  return board;
}
