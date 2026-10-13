// Prepare an explicitly unlocked LOCAL review copy, without changing shipping settings.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const input = path.join(root, 'extension/dist');
const output = path.join(root, 'review/extension');
if (!fs.existsSync(path.join(input, 'manifest.json'))) throw new Error('Run npm run build:release first.');
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.cpSync(input, output, { recursive: true });
fs.writeFileSync(path.join(output, 'config.js'), "globalThis.MEMEBOX_CONFIG = Object.freeze({SITE_URL:'http://127.0.0.1:8789',STORE_URL:'',PRO_ENABLED:false,SHOP_OPEN:false});\n");
const manifest = JSON.parse(fs.readFileSync(path.join(output, 'manifest.json'), 'utf8'));
manifest.name = 'MemeBox Local Review';
manifest.version_name = manifest.version + ' local review';
fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
fs.appendFileSync(path.join(output, 'options.css'), '\n/* Local review: purchases are unavailable. */\n#buy { display:none !important; }\n');
console.log('Local review prepared: review/extension. Do not publish this unlocked build.');
