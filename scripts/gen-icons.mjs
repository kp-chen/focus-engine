// Generates the PWA icons committed under public/ from a single description:
// a solid #0a0a0f field with a light "focus" glyph (the app's ◎ mark — an
// outer ring with a filled centre dot, in the focus accent #f06040).
//
// We render to raw RGBA pixels and encode a PNG by hand (Node's zlib for the
// IDAT deflate, a small CRC32 for the chunks) so there is no image-library
// dependency. Run with `npm run icons`. The source-of-truth vector is
// public/icon.svg; these PNGs are the rasterised manifest icons.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

const BG = [0x0a, 0x0a, 0x0f]; // #0a0a0f
const FG = [0xf0, 0x60, 0x40]; // #f06040 focus accent
const RING = [0xe8, 0xe8, 0xec]; // #e8e8ec light

// --- PNG encoding ---------------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // colour type RGBA
  // 10,11,12 = compression/filter/interlace = 0
  // Add a per-scanline filter byte (0 = none) in front of each row.
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- glyph rasteriser -----------------------------------------------------
function makeIcon(size, { maskable = false } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  // Maskable icons must keep content inside a ~80% safe zone (the platform can
  // crop to a circle); shrink the glyph for those.
  const scale = maskable ? 0.62 : 0.78;
  const rOuter = (size / 2) * scale;          // outer ring radius
  const ringW = size * (maskable ? 0.05 : 0.055);
  const rDot = rOuter * 0.42;                 // centre dot radius

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      let col = BG;
      // outer ring (light) with 1px-ish antialias band
      if (d <= rOuter + 0.5 && d >= rOuter - ringW - 0.5) {
        col = RING;
      }
      // centre dot (accent)
      if (d <= rDot + 0.5) {
        col = FG;
      }
      const i = (y * size + x) * 4;
      rgba[i] = col[0];
      rgba[i + 1] = col[1];
      rgba[i + 2] = col[2];
      rgba[i + 3] = 255;
    }
  }
  return encodePNG(size, rgba);
}

const targets = [
  { name: 'pwa-192x192.png', size: 192 },
  { name: 'pwa-512x512.png', size: 512 },
  { name: 'maskable-512x512.png', size: 512, maskable: true },
  { name: 'apple-touch-icon.png', size: 180 },
];

for (const t of targets) {
  const png = makeIcon(t.size, { maskable: t.maskable });
  writeFileSync(join(PUBLIC, t.name), png);
  console.log(`wrote public/${t.name} (${png.length} bytes)`);
}
