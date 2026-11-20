import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { exportLeaderboard, loadLeaderboard, saveLeaderboardEntry } from './leaderboard.js';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

const argv = process.argv.slice(2);
const exportIdx = argv.indexOf('--export-leaderboard');
if (exportIdx !== -1) {
  const outPath = argv[exportIdx + 1];
  if (!outPath) {
    process.stderr.write('Usage: node src/run.js --export-leaderboard <out.json>\n');
    process.exit(1);
  }
  exportLeaderboard(outPath);
  process.exit(0);
}

const distDir = path.resolve('dist');
if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  process.stderr.write('dist/index.html not found. Run "npm run build" first.\n');
  process.exit(1);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1');

  if (url.pathname === '/api/leaderboard') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(loadLeaderboard()));
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        try {
          const updated = saveLeaderboardEntry(JSON.parse(body));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(updated));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
  }

  let filePath = path.join(distDir, url.pathname === '/' ? 'index.html' : url.pathname);
  if (!filePath.startsWith(distDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(distDir, 'index.html');
  }
  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

const port = Number(process.env.PORT) || 4173;
server.listen(port, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${port}`;
  console.log(`Đảo Đèn Lồng v1.0.0 running at ${url}`);
  if (process.env.NO_OPEN !== '1') {
    const opener = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
      : process.platform === 'darwin' ? ['open', [url]]
      : ['xdg-open', [url]];
    try {
      spawn(opener[0], opener[1], { detached: true, stdio: 'ignore' }).unref();
    } catch {}
  }
});
