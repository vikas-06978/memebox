import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { R2Disk } from '../../tools/r2-disk.mjs';

test('local R2 files and content type survive a new bucket instance', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'memebox-r2-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const first = new R2Disk(root);
  await first.put('packs/demo/clip.wav', new Uint8Array([1, 2, 3]), { httpMetadata: { contentType: 'audio/wav' } });
  const second = new R2Disk(root);
  const saved = await second.get('packs/demo/clip.wav');
  assert.deepEqual([...new Uint8Array(await saved.arrayBuffer())], [1, 2, 3]);
  assert.equal(saved.httpMetadata.contentType, 'audio/wav');
  await second.delete('packs/demo/clip.wav');
  assert.equal(await first.head('packs/demo/clip.wav'), null);
});

