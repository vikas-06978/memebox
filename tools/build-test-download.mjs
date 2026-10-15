// Assemble a self-contained Windows/macOS/Linux review download. The extension
// retains paid gates; only its player location is changed to the bundled HTTP companion.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { copyRoom } from './sync-music-room.mjs';

const root=path.resolve(import.meta.dirname,'..');
const version=JSON.parse(fs.readFileSync(path.join(root,'extension/dist/manifest.json'),'utf8')).version;
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'memebox-test-download-'));
const folder=path.join(scratch,`MemeBox-${version}-Test`);fs.mkdirSync(folder);
fs.cpSync(path.join(root,'extension/dist'),path.join(folder,'extension'),{recursive:true});
const config=path.join(folder,'extension/config.js');
fs.appendFileSync(config,"\nglobalThis.MEMEBOX_CONFIG=Object.freeze({...globalThis.MEMEBOX_CONFIG,PLAYER_URL:'http://127.0.0.1:8790/music-room.html'});\n");
copyRoom(path.join(folder,'extension'),path.join(folder,'music-room'));
// The companion uses the included catalog immediately. It does not need the live site or a database.
const starter=fs.readFileSync(path.join(folder,'music-room/lib/starter-catalog.js'),'utf8');
fs.writeFileSync(path.join(folder,'music-room/preview-catalog.js'),starter+'\nglobalThis.MemeBoxPreviewCatalog=globalThis.MemeBoxBundledCatalog;\n');
const html=path.join(folder,'music-room/music-room.html');fs.writeFileSync(html,fs.readFileSync(html,'utf8').replace('<script src="music-room.js"></script>','<script src="preview-catalog.js"></script><script src="music-room.js"></script>'));
for(const file of ['Start-MemeBox-Music.cmd','Start-MemeBox-Music.ps1','Start-MemeBox-Music.command','start-music.py'])fs.copyFileSync(path.join(root,'review',file),path.join(folder,file));
fs.writeFileSync(path.join(folder,'START-HERE.txt'),`MEMEBOX ${version} - PLAYER FIX TEST\n\n1. Extract this entire folder to a NEW folder. Keep the installed store extension and its data. Use a separate Chrome profile for testing.\n2. Windows: double-click Start-MemeBox-Music.cmd and keep that window open. No Node installation or system policy change is needed. macOS/Linux: run python3 start-music.py (Python 3 required).\n3. In Chrome open chrome://extensions, enable Developer mode, Load unpacked, select this folder's extension subfolder.\n4. Open the extension Options / studio. Music, Phonk and Video memes use the current bundled player at http://127.0.0.1:8790/music-room.html. No old website redirect.\n5. All 16 original tunes, 14 characters and all filters are visible for preview. Paid outgoing effects still require a pass/license. Checkout is closed.\n6. For playlists/memes use Play. For Everyone in call, join a browser call with your mic, select the player tab and enable Share tab audio when asked. Provider restrictions may still affect individual videos.\n7. Do not upload this test folder to the Web Store: its player address is local. The separate production ZIP is for the eventual release after the current player/backend is deployed.\n\nNo account, payment approval, live website or database was changed by this download.\n`);
const output=path.join(root,`memebox-${version}-test.zip`);
execFileSync('python3',['-c',`import pathlib,zipfile,sys
source=pathlib.Path(sys.argv[1]);out=sys.argv[2]
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for p in sorted(source.rglob('*')):
  if p.is_file():z.write(p,p.relative_to(source.parent))
`,folder,output],{stdio:'inherit'});
console.log('Self-contained test download: '+output);
