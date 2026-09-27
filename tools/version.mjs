// npm run version:set -- 1.2.3   – sets the version in package.json and extension/manifest.json.
import fs from 'node:fs';
import path from 'node:path';

const v = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(v || '')) {
  console.error('usage: node tools/version.mjs <major.minor.patch>');
  process.exit(1);
}
const root = path.resolve(import.meta.dirname, '..');
for (const rel of ['package.json', 'extension/manifest.json']) {
  const file = path.join(root, rel);
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  json.version = v;
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n');
}
console.log('version', v);
