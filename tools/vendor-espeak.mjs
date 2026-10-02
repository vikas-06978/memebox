// Refreshes vendor/espeak-ng/ from the @echogarden/espeak-ng-emscripten npm package,
// keeping only the Hindi and English dictionaries (about 24 MB -> about 1.5 MB).
//
// You do NOT need to run this to use the extension: the output is already
// committed in vendor/espeak-ng/. It exists so the bundled binary can be
// reproduced and updated (GPL "corresponding source" friendliness).
//
// Usage:  npm run vendor           (downloads the package with `npm pack`)
//         node tools/vendor-espeak.mjs <path-to-unpacked-package-dir>

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

const PKG = '@echogarden/espeak-ng-emscripten@0.3.5';
const KEEP_DICTS = new Set(['en_dict', 'hi_dict']);
const outDir = path.resolve(import.meta.dirname, '..', 'extension', 'vendor', 'espeak-ng');

let srcDir = process.argv[2];
if (!srcDir) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'espeak-'));
  execSync(`npm pack ${PKG} --silent`, { cwd: tmp, stdio: ['ignore', 'pipe', 'inherit'] });
  const tgz = fs.readdirSync(tmp).find((f) => f.endsWith('.tgz'));
  execSync(`tar -xzf "${tgz}"`, { cwd: tmp });
  srcDir = path.join(tmp, 'package');
}

const js = fs.readFileSync(path.join(srcDir, 'espeak-ng.js'), 'utf8');
const data = fs.readFileSync(path.join(srcDir, 'espeak-ng.data'));

const metaStart = js.indexOf('loadPackage({files:[');
const metaEnd = js.indexOf('})', metaStart);
if (metaStart < 0 || metaEnd < 0) throw new Error('package metadata not found');
const meta = js.slice(metaStart, metaEnd + 2);

const files = [...meta.matchAll(/\{filename:"([^"]+)",start:(\d+),end:(\d+)\}/g)]
  .map((m) => ({ filename: m[1], start: +m[2], end: +m[3] }));

const keep = files.filter(({ filename }) => {
  const base = path.posix.basename(filename);
  if (base.endsWith('_dict')) return KEEP_DICTS.has(base);
  if (filename.includes('/voices/mb/')) return false; // MBROLA voices need external data
  return true;
});

const parts = [];
let offset = 0;
const entries = keep.map(({ filename, start, end }) => {
  parts.push(data.subarray(start, end));
  const entry = `{filename:${JSON.stringify(filename)},start:${offset},end:${offset + end - start}}`;
  offset += end - start;
  return entry;
});
const newMeta = `loadPackage({files:[${entries.join(',')}],remote_package_size:${offset}})`;

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'espeak-ng.js'), js.slice(0, metaStart) + newMeta + js.slice(metaEnd + 2));
fs.writeFileSync(path.join(outDir, 'espeak-ng.data'), Buffer.concat(parts));
fs.copyFileSync(path.join(srcDir, 'COPYING'), path.join(outDir, 'COPYING'));
console.log(`kept ${keep.length}/${files.length} files, data ${(offset / 1e6).toFixed(2)} MB -> ${outDir}`);
