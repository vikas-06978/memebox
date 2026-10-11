// A small stand-in for a Cloudflare R2 bucket (in memory), for tests and local runs.
// Supports what the site uses: put(key, value, { httpMetadata }), get(key), head(key), delete(key | keys[]).
export class R2Memory {
  constructor() { this.map = new Map(); }

  async put(key, value, options = {}) {
    let bytes;
    if (value instanceof ArrayBuffer) bytes = new Uint8Array(value);
    else if (ArrayBuffer.isView(value)) bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    else if (typeof value === 'string') bytes = new TextEncoder().encode(value);
    else bytes = new Uint8Array(await new Response(value).arrayBuffer());
    this.map.set(key, { bytes: new Uint8Array(bytes), httpMetadata: options.httpMetadata || {} });
    return { key, size: bytes.byteLength };
  }

  async get(key) {
    const o = this.map.get(key);
    if (!o) return null;
    return { key, size: o.bytes.byteLength, httpMetadata: o.httpMetadata, body: new Blob([o.bytes]).stream(), arrayBuffer: async () => o.bytes.slice().buffer };
  }

  async head(key) {
    const o = this.map.get(key);
    return o ? { key, size: o.bytes.byteLength, httpMetadata: o.httpMetadata } : null;
  }

  async delete(keys) {
    for (const k of [].concat(keys)) this.map.delete(k);
  }
}
