import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function parseArgs(argv) {
  const args = { seed: 42, duration: 30, out: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--seed') args.seed = Number(argv[++i]);
    else if (argv[i] === '--duration') args.duration = Number(argv[++i]);
    else if (argv[i] === '--out') args.out = argv[++i];
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  if (!Number.isInteger(args.seed)) throw new Error('Invalid --seed');
  if (!Number.isFinite(args.duration) || args.duration <= 0) throw new Error('Invalid --duration');
  if (!args.out) throw new Error('Missing --out <bench.json>');
  return args;
}

function findBrowser() {
  if (process.env.CHROME_BIN && fs.existsSync(process.env.CHROME_BIN)) {
    return process.env.CHROME_BIN;
  }
  const candidates = process.platform === 'win32'
    ? [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      ]
    : process.platform === 'darwin'
    ? [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      ]
    : [
        '/usr/bin/google-chrome',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/snap/bin/chromium',
      ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

async function main() {
  const procStartMs = performance.now();
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`CLI error: ${err.message}\n`);
    process.exit(1);
  }

  const distDir = path.resolve('dist');
  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    process.stderr.write('dist/index.html not found. Run "npm run build" first.\n');
    process.exit(1);
  }

  const browserPath = findBrowser();
  if (!browserPath) {
    process.stderr.write('No Chromium/Chrome/Edge browser found. Set CHROME_BIN to run bench.\n');
    process.exit(1);
  }

  const tmpProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-bench-'));
  let browserProc = null;
  let firstFrameAtMs = null;

  const cleanup = () => {
    try {
      if (browserProc && !browserProc.killed) browserProc.kill();
    } catch {}
    try {
      fs.rmSync(tmpProfile, { recursive: true, force: true });
    } catch {}
  };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');

    if (url.pathname === '/__bench_ready' && req.method === 'POST') {
      if (firstFrameAtMs === null) firstFrameAtMs = performance.now();
      res.writeHead(200);
      res.end('ok');
      return;
    }

    if (url.pathname === '/__bench_result' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        res.writeHead(200);
        res.end('ok');
        try {
          const payload = JSON.parse(body);
          const loadMs = Math.round((firstFrameAtMs !== null ? firstFrameAtMs : performance.now()) - procStartMs);
          const report = {
            contract_version: '1.3',
            avg_fps: payload.avg_fps,
            p1_low_fps: payload.p1_low_fps,
            frame_ms_p95: payload.frame_ms_p95,
            frames: payload.frames,
            load_ms: loadMs,
            peak_mem_mb: payload.peak_mem_mb ?? null,
            vsync_off: true,
            renderer: payload.renderer || 'Three.js 0.170 WebGLRenderer',
            os: `${os.platform()} ${os.release()} (${os.arch()})`,
          };
          const outResolved = path.resolve(args.out);
          fs.mkdirSync(path.dirname(outResolved), { recursive: true });
          fs.writeFileSync(outResolved, JSON.stringify(report, null, 2) + '\n', 'utf8');
          console.log(JSON.stringify(report, null, 2));
          server.close();
          cleanup();
          process.exit(0);
        } catch (err) {
          process.stderr.write(`Bench parse error: ${err.message}\n`);
          server.close();
          cleanup();
          process.exit(1);
        }
      });
      return;
    }

    let filePath = path.join(distDir, url.pathname === '/' ? 'index.html' : url.pathname);
    if (!filePath.startsWith(distDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(distDir, 'index.html');
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });

  server.listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    const targetUrl = `http://127.0.0.1:${port}/index.html?bench=1&seed=${args.seed}&duration=${args.duration}`;
    const flags = [
      `--app=${targetUrl}`,
      '--window-size=1280,720',
      '--disable-frame-rate-limit',
      '--disable-gpu-vsync',
      '--no-first-run',
      '--no-default-browser-check',
      '--autoplay-policy=no-user-gesture-required',
      `--user-data-dir=${tmpProfile}`,
    ];
    browserProc = spawn(browserPath, flags, { stdio: 'ignore' });
    browserProc.on('exit', (code) => {
      // Only error if process exited before reporting
      setTimeout(() => {
        if (server.listening) {
          process.stderr.write(`Browser exited prematurely with code ${code}\n`);
          server.close();
          cleanup();
          process.exit(1);
        }
      }, 500);
    });
  });

  // Safety timeout
  setTimeout(() => {
    process.stderr.write('Benchmark timed out\n');
    server.close();
    cleanup();
    process.exit(1);
  }, (args.duration + 45) * 1000).unref();
}

main();
