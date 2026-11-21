import { existsSync, readdirSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import process from 'node:process';

const root = resolve(import.meta.dirname, '..');
const target = process.argv[2] ?? 'all';
const kib = 1024;
const mib = 1024 * kib;
let failed = false;

function check(label, actual, maximum) {
  const unit = maximum >= mib ? mib : kib;
  const unitLabel = unit === mib ? 'MiB' : 'KiB';
  const value = (actual / unit).toFixed(1);
  const limit = (maximum / unit).toFixed(1);
  console.log(`${label}: ${value} ${unitLabel} (budget ${limit} ${unitLabel})`);
  if (actual > maximum) {
    console.error(`${label} exceeds its performance budget.`);
    failed = true;
  }
}

function webBudget() {
  const assets = join(root, 'web', 'dist', 'assets');
  if (!existsSync(assets)) throw new Error('Build web/ before checking its budget.');
  const files = readdirSync(assets).map((name) => ({
    name,
    bytes: statSync(join(assets, name)).size,
  }));
  const total = (extension) => files
    .filter(({ name }) => extname(name) === extension)
    .reduce((sum, { bytes }) => sum + bytes, 0);
  check('Web JavaScript', total('.js'), 400 * kib);
  check('Web CSS', total('.css'), 25 * kib);
}

function appBudget() {
  const apk = join(root, 'app', 'build', 'app', 'outputs', 'flutter-apk', 'app-debug.apk');
  if (!existsSync(apk)) throw new Error('Build the debug APK before checking its budget.');
  check('Android debug APK', statSync(apk).size, 150 * mib);
}

if (!['web', 'app', 'all'].includes(target)) {
  throw new Error('Usage: node scripts/performance-budget.mjs [web|app|all]');
}
if (target === 'web' || target === 'all') webBudget();
if (target === 'app' || target === 'all') appBudget();
if (failed) process.exitCode = 1;
