// Prepare an explicitly unlocked LOCAL review copy, without changing shipping settings.
import fs from 'node:fs';
import path from 'node:path';
import { copyRoom } from './sync-music-room.mjs';
import { CURATED_VIDEO_GROUPS } from '../site/src/curated-video-catalog.js';

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

copyRoom(output, path.join(root, 'review/music-room'));
const reviewRoom = path.join(root, 'review/music-room');
const previewCatalog = [];
const regionalTitle = lang => ({ fa: 'Persian memes', vi: 'Vietnamese memes', pt: 'Brazil & Portuguese memes', ru: 'Russian memes', uk: 'Ukrainian memes', zh: 'Chinese memes' }[lang] || 'Worldwide & English memes');
for (const group of CURATED_VIDEO_GROUPS) {
  if (group.name !== 'worldwide') {
    previewCatalog.push({ kind: group.kind, title: group.packTitle, items: group.items.map(({ videoId, title, credit, explicit, lang }) => ({ videoId, title, credit, explicit, lang })) });
    continue;
  }
  for (const item of group.items) {
    const title = regionalTitle(item.lang), existing = previewCatalog.find(pack => pack.kind === group.kind && pack.title === title);
    const pack = existing || { kind: group.kind, title, items: [] };
    if (!existing) previewCatalog.push(pack);
    const { videoId, credit, explicit, lang } = item;
    pack.items.push({ videoId, title: item.title, credit, explicit, lang });
  }
}
fs.writeFileSync(path.join(reviewRoom, 'preview-catalog.js'), `globalThis.MemeBoxPreviewCatalog=${JSON.stringify(previewCatalog)};\n`);
const roomHtml = path.join(reviewRoom, 'music-room.html');
fs.writeFileSync(roomHtml, fs.readFileSync(roomHtml, 'utf8').replace('<script src="music-room.js"></script>', '<script src="preview-catalog.js"></script><script src="music-room.js"></script>'));
console.log('Static music room prepared for the local review launcher.');
