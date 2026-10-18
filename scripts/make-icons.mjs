// Draws the toolbar icon (rounded indigo square with a white check) as PNGs, no dependencies.
// Usage: node scripts/make-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const SIZES = [16, 32, 48, 96, 128];
const BG = [79, 70, 229];
const SS = 4; // supersampling for anti-aliasing

function coverage(x, y) {
  // Rounded square, radius 22% of the side, in unit coordinates.
  const r = 0.22;
  const dx = Math.max(Math.abs(x - 0.5) - (0.5 - r), 0);
  const dy = Math.max(Math.abs(y - 0.5) - (0.5 - r), 0);
  const inSquare = dx * dx + dy * dy <= r * r;
  if (!inSquare) return 0;
  // Check mark: two thick segments.
  const onCheck =
    distToSegment(x, y, 0.27, 0.53, 0.43, 0.69) < 0.075 ||
    distToSegment(x, y, 0.43, 0.69, 0.74, 0.34) < 0.075;
  return onCheck ? 2 : 1;
}

function distToSegment(px, py, ax, ay, bx, by) {
  const t = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
  return Math.hypot(px - (ax + t * (bx - ax)), py - (ay + t * (by - ay)));
}

function render(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      let bg = 0, check = 0;
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const c = coverage((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size);
          if (c === 1) bg++;
          if (c === 2) check++;
        }
      const n = SS * SS, a = (bg + check) / n, w = check / Math.max(bg + check, 1);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      for (let i = 0; i < 3; i++) raw[o + i] = Math.round(BG[i] * (1 - w) + 255 * w);
      raw[o + 3] = Math.round(a * 255);
    }
  }
  return png(size, raw);
}

function png(size, raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

mkdirSync('public/icon', { recursive: true });
for (const size of SIZES) writeFileSync(`public/icon/${size}.png`, render(size));
console.log(`wrote ${SIZES.map((s) => `public/icon/${s}.png`).join(', ')}`);
