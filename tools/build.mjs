// npm run build: copies the extension into extension/dist, ready to load unpacked or zip.
// The extension is plain JavaScript, so "building" is a clean copy plus license files.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const src = path.join(root, 'extension');
const out = path.join(src, 'dist');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const SKIP = new Set(['dist']);
for (const name of fs.readdirSync(src)) {
  if (SKIP.has(name) || name.startsWith('.')) continue;
  fs.cpSync(path.join(src, name), path.join(out, name), { recursive: true });
}
for (const f of ['LICENSE', 'THIRD_PARTY_NOTICES.md']) fs.copyFileSync(path.join(root, f), path.join(out, f));

const manifest = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'));
console.log(`built ${manifest.name} ${manifest.version} -> ${path.relative(root, out)}`);
