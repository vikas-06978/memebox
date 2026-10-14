// Persistent local stand-in for Cloudflare R2. Used only by `npm run site:dev` so owner uploads
// survive a restart. Tests keep using the isolated in-memory bucket.
import fs from 'node:fs';
import path from 'node:path';

export class R2Disk {
  constructor(root) {
    this.root = path.resolve(root);
    fs.mkdirSync(this.root, { recursive: true });
  }

  file(key) {
    const clean = String(key || '').replace(/\\/g, '/');
    if (!/^[a-zA-Z0-9._/-]+$/.test(clean) || clean.split('/').includes('..')) throw new Error('Invalid local object key');
    const out = path.resolve(this.root, clean);
    if (out !== this.root && !out.startsWith(this.root + path.sep)) throw new Error('Invalid local object path');
    return out;
  }

  async put(key, value, options = {}) {
    let bytes;
    if (value instanceof ArrayBuffer) bytes = new Uint8Array(value);
    else if (ArrayBuffer.isView(value)) bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    else if (typeof value === 'string') bytes = new TextEncoder().encode(value);
    else bytes = new Uint8Array(await new Response(value).arrayBuffer());
    const file = this.file(key);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, bytes);
    fs.writeFileSync(file + '.meta.json', JSON.stringify({ httpMetadata: options.httpMetadata || {} }));
    return { key, size: bytes.byteLength };
  }

  metadata(file) {
    try { return JSON.parse(fs.readFileSync(file + '.meta.json', 'utf8')).httpMetadata || {}; }
    catch { return {}; }
  }

  async get(key) {
    const file = this.file(key);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return null;
    const bytes = fs.readFileSync(file), httpMetadata = this.metadata(file);
    return { key, size: bytes.byteLength, httpMetadata, body: new Blob([bytes]).stream(), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
  }

  async head(key) {
    const file = this.file(key);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return null;
    return { key, size: fs.statSync(file).size, httpMetadata: this.metadata(file) };
  }

  async delete(keys) {
    for (const key of [].concat(keys)) {
      const file = this.file(key);
      for (const target of [file, file + '.meta.json']) if (fs.existsSync(target)) fs.unlinkSync(target);
    }
  }
}
