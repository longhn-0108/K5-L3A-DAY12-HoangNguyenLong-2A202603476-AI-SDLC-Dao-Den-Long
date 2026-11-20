import fs from 'node:fs';
import path from 'node:path';
import { GameEngine } from './sim/engine.js';
import { SeededPRNG } from './sim/prng.js';
import { TICK_RATE } from './sim/tuning.js';

function parseArgs(argv) {
  const args = { seed: 7, nights: 10, out: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--seed') args.seed = Number(argv[++i]);
    else if (argv[i] === '--nights') args.nights = Number(argv[++i]);
    else if (argv[i] === '--out') args.out = argv[++i];
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  if (!Number.isInteger(args.seed)) throw new Error('Invalid --seed');
  if (!Number.isInteger(args.nights) || args.nights <= 0) throw new Error('Invalid --nights');
  if (!args.out) throw new Error('Missing --out <soak.json>');
  return args;
}

function rssMb() {
  return Math.round((process.memoryUsage().rss / (1024 * 1024)) * 10) / 10;
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`CLI error: ${err.message}\n`);
    process.exit(1);
  }

  const t0 = performance.now();
  const results = [];
  let crashes = 0;
  let memStartMb = 0;

  // Warm up V8 JIT for GameEngine before Night 1 so RSS delta reflects true memory stability (not one-time JIT compile)
  {
    for (const wn of [1, 2, 3]) {
      const warm = new GameEngine({ seed: wn, night: wn });
      for (let w = 0; w < 600 && warm.state === 'playing'; w++) {
        warm.step({ move: [1, 0], jump: w % 20 === 0, dash: w % 30 === 0, pulse: w % 50 === 0, interact: w % 10 === 0 });
      }
    }
    if (typeof global.gc === 'function') global.gc();
  }

  for (let i = 0; i < args.nights; i++) {
    const night = (i % 3) + 1;
    const nightSeed = args.seed + i;
    const inputRng = new SeededPRNG(nightSeed * 31 + 17);

    try {
      let engine = new GameEngine({ seed: nightSeed, night });
      if (i === 0) {
        memStartMb = rssMb();
      }

      const maxTicks = engine.map.durationS * TICK_RATE + 10;
      let move = [0, 0];

      for (let t = 0; t < maxTicks && engine.state === 'playing'; t++) {
        if (t % 30 === 0) {
          const ang = inputRng.range(0, Math.PI * 2);
          move = [Math.cos(ang), Math.sin(ang)];
        }
        const input = {
          move,
          cam_yaw_deg: 0,
          jump: inputRng.next() < 0.05,
          dash: inputRng.next() < 0.03,
          pulse: inputRng.next() < 0.02,
          interact: inputRng.next() < 0.1,
          pause: false,
        };
        engine.step(input);
      }

      results.push(engine.state === 'won' ? 'won' : 'lost');
      engine = null;
    } catch (err) {
      crashes += 1;
      results.push('crash');
      process.stderr.write(`Soak crash on night index ${i}: ${err.message}\n`);
    }
  }

  if (typeof global.gc === 'function') global.gc();
  const memEndMb = rssMb();
  const durationS = Math.round(((performance.now() - t0) / 1000) * 100) / 100;

  const report = {
    nights: args.nights,
    crashes,
    results,
    mem_start_mb: memStartMb,
    mem_end_mb: memEndMb,
    duration_s: durationS,
  };

  const outResolved = path.resolve(args.out);
  fs.mkdirSync(path.dirname(outResolved), { recursive: true });
  fs.writeFileSync(outResolved, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(report));
}

main();
