import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const report = resolve(import.meta.dirname, '..', 'app', 'coverage', 'lcov.info');
const minimumPercent = 17;

if (!existsSync(report)) {
  throw new Error('Run `flutter test --coverage` before checking Flutter coverage.');
}

const summaries = readFileSync(report, 'utf8').split(/\r?\n/);
const sum = (prefix) => summaries
  .filter((line) => line.startsWith(prefix))
  .reduce((total, line) => total + Number(line.slice(prefix.length)), 0);
const found = sum('LF:');
const hit = sum('LH:');

if (!found || !Number.isFinite(found) || !Number.isFinite(hit)) {
  throw new Error('Flutter LCOV report does not contain a valid line summary.');
}

const percent = hit / found * 100;
console.log(
  `Flutter line coverage: ${percent.toFixed(2)}% (${hit}/${found}; budget ${minimumPercent.toFixed(2)}%)`,
);
if (percent < minimumPercent) {
  console.error('Flutter line coverage is below its non-regression budget.');
  process.exitCode = 1;
}
