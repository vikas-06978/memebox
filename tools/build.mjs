// npm run build: copies the extension into extension/dist, ready to load unpacked or zip.
// The extension is plain JavaScript, so "building" is a clean copy plus license files.
import fs from 'node:fs';
import path from 'node:path';
import { transform } from 'esbuild';

const root = path.resolve(import.meta.dirname, '..');
const src = path.join(root, 'extension');
const out = path.join(src, 'dist');
const release = process.argv.includes('--release');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const SKIP = new Set(['dist']);
for (const name of fs.readdirSync(src)) {
  if (SKIP.has(name) || name.startsWith('.')) continue;
  fs.cpSync(path.join(src, name), path.join(out, name), { recursive: true });
}
for (const f of ['LICENSE', 'THIRD_PARTY_NOTICES.md']) fs.copyFileSync(path.join(root, f), path.join(out, f));

if (release) {
  const compress = async dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) await compress(file);
      else if (entry.name.endsWith('.js') || entry.name.endsWith('.css')) {
        // Leave vendored libraries intact, including their license notices.
        if (file.includes(path.sep + 'vendor' + path.sep)) continue;
        const result = await transform(fs.readFileSync(file, 'utf8'), {
          loader: entry.name.endsWith('.css') ? 'css' : 'js', minify: true,
          legalComments: 'inline', sourcemap: false, target: 'chrome120',
        });
        fs.writeFileSync(file, result.code);
      }
    }
  };
  await compress(out);
}

const manifest = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'));
console.log(`built ${manifest.name} ${manifest.version}${release ? ' (minified release candidate)' : ''} -> ${path.relative(root, out)}`);
