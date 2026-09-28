// Draws the MemeBox icon (a laughing face with sound waves) into icons/icon{16,32,48,128}.png.
// Pure Node, no image libraries. Run: npm run icons
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const outDir = path.resolve(import.meta.dirname, '..', 'extension', 'icons');

const C = {
  face: [255, 212, 59], edge: [92, 61, 0], mouth: [122, 31, 31], tongue: [255, 107, 129], wave: [28, 126, 214],
};

// Returns [r,g,b,a] for a point in unit coordinates (0..1, y down).
function shade(x, y, waves) {
  const fx = 0.43, fy = 0.56, fr = 0.39;
  const d = Math.hypot(x - fx, y - fy);
  let px = null;

  if (waves) {
    const wx = 0.70, wy = 0.30;
    const ang = Math.atan2(y - wy, x - wx);
    if (ang > -1.35 && ang < 0.35) {
      const r = Math.hypot(x - wx, y - wy);
      for (const R of [0.13, 0.22]) if (Math.abs(r - R) < 0.028) px = C.wave;
    }
  }

  if (d <= fr) {
    px = d > fr - 0.04 ? C.edge : C.face;
    // Laughing eyes: upside-down U arcs.
    for (const ex of [fx - 0.14, fx + 0.14]) {
      const ey = fy - 0.07;
      const r = Math.hypot(x - ex, y - ey);
      if (y <= ey + 0.005 && Math.abs(r - 0.075) < 0.028) px = C.edge;
    }
    // Big open mouth: lower half disk with a tongue.
    const my = fy + 0.03, mr = 0.22;
    const md = Math.hypot(x - fx, y - my);
    if (y >= my && md <= mr) {
      px = md > mr - 0.035 || y < my + 0.03 ? C.edge : C.mouth;
      if (Math.hypot(x - fx, y - (my + 0.2)) < 0.1 && md <= mr - 0.035) px = C.tongue;
    }
  }
  return px;
}

function render(size) {
  const S = 6; // supersampling
  const rgba = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
        const c = shade((px + (sx + 0.5) / S) / size, (py + (sy + 0.5) / S) / size, size >= 32);
        if (c) { r += c[0]; g += c[1]; b += c[2]; a++; }
      }
      const o = (py * size + px) * 4;
      if (a) { rgba[o] = r / a; rgba[o + 1] = g / a; rgba[o + 2] = b / a; }
      rgba[o + 3] = Math.round((a / (S * S)) * 255);
    }
  }
  return rgba;
}

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

fs.mkdirSync(outDir, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  fs.writeFileSync(path.join(outDir, `icon${size}.png`), png(size, render(size)));
  console.log('icons/icon' + size + '.png');
}
