import fs from 'node:fs';
import path from 'node:path';
import { GameEngine } from './sim/engine.js';
import { InputTimeline, validateInputs } from './sim/inputs.js';
import { ValidationError, validateScenario } from './sim/scenario.js';

function parseArgs(argv) {
  const args = {
    seed: null,
    night: null,
    scenario: null,
    inputs: null,
    ticks: null,
    out: null,
    snapshotEvery: 10,
  };

  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const next = argv[i + 1];
    switch (flag) {
      case '--seed':
        args.seed = Number(next);
        i++;
        break;
      case '--night':
        args.night = Number(next);
        i++;
        break;
      case '--scenario':
        args.scenario = next;
        i++;
        break;
      case '--inputs':
        args.inputs = next;
        i++;
        break;
      case '--ticks':
        args.ticks = Number(next);
        i++;
        break;
      case '--out':
        args.out = next;
        i++;
        break;
      case '--snapshot-every':
        args.snapshotEvery = Number(next);
        i++;
        break;
      default:
        throw new Error(`Unknown argument: ${flag}`);
    }
  }

  if (!Number.isInteger(args.seed)) throw new Error('Missing or invalid --seed <int>');
  if (args.night !== 1) throw new Error('Invalid --night (Phase 1 supports --night 1)');
  if (!Number.isInteger(args.ticks) || args.ticks < 0) throw new Error('Missing or invalid --ticks <int>');
  if (!args.out || typeof args.out !== 'string') throw new Error('Missing --out <file.jsonl>');
  if (!Number.isInteger(args.snapshotEvery) || args.snapshotEvery <= 0) {
    throw new Error('Invalid --snapshot-every <int> (must be > 0)');
  }

  return args;
}

function readJsonFile(filePath, label) {
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    throw new ValidationError(`Cannot read ${label} file "${filePath}": ${err.message}`);
  }
  try {
    return JSON.parse(content);
  } catch (err) {
    throw new ValidationError(`Malformed JSON in ${label} file "${filePath}": ${err.message}`);
  }
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`CLI error: ${err.message}\n`);
    process.exit(1);
  }

  let scenario = null;
  let inputs = null;
  try {
    if (args.scenario) {
      scenario = validateScenario(readJsonFile(args.scenario, 'scenario'));
    }
    if (args.inputs) {
      inputs = validateInputs(readJsonFile(args.inputs, 'inputs'));
    }
  } catch (err) {
    process.stderr.write(`Validation error: ${err.message}\n`);
    process.exit(err instanceof ValidationError ? err.exitCode : 2);
  }

  try {
    const engine = new GameEngine({ seed: args.seed, night: args.night, scenario });
    const timeline = new InputTimeline(inputs);
    const lines = [];

    // Tick 0 snapshot (post-scenario, pre-input)
    lines.push(JSON.stringify(engine.getSnapshot()));

    for (let k = 0; k < args.ticks && engine.state === 'playing'; k++) {
      const input = timeline.getInputForTick(k);
      const events = engine.step(input);
      for (const ev of events) {
        lines.push(JSON.stringify(ev));
      }
      if (engine.tick % args.snapshotEvery === 0) {
        lines.push(JSON.stringify(engine.getSnapshot()));
      }
    }

    lines.push(JSON.stringify(engine.getEndRecord()));

    const outDir = path.dirname(path.resolve(args.out));
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(args.out, lines.join('\n') + '\n', 'utf8');
  } catch (err) {
    process.stderr.write(`Runtime error: ${err.message}\n`);
    process.exit(1);
  }
}

main();
