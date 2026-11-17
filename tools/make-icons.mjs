// Generates icons/icon{16,32,48,128}.png: a "[ ▶ ]" clip mark on an indigo tile, and
// store/store-icon-128.png: the same at 96x96 with 16px of transparent space around it, as the
// Chrome Web Store asks for its listing icon.
// Run with: node tools/make-icons.mjs   (no dependencies)
import { deflateSync, crc32 } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT_URL = new URL('../icons/', import.meta.url);
const SIZES = [16, 32, 48, 128];
const SAMPLES = 4; // supersampling per axis, for anti-aliasing

// Shapes in a 128x128 design space.
const TOP = [0x63, 0x66, 0xf1]; // gradient top
const BOTTOM = [0x43, 0x38, 0xca]; // gradient bottom
const rects = [
  [22, 34, 32, 94], [22, 34, 44, 44], [22, 84, 44, 94], // [
  [96, 34, 106, 94], [84, 34, 106, 44], [84, 84, 106, 94], // ]
];
const triangle = [[54, 46], [54, 82], [83, 64]];

function inRoundRect(x, y, x0, y0, x1, y1, r) {
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

function inTriangle(x, y, [a, b, c]) {
  const side = (p, q) => (x - q[0]) * (p[1] - q[1]) - (p[0] - q[0]) * (y - q[1]);
  const d1 = side(a, b), d2 = side(b, c), d3 = side(c, a);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}

function sample(x, y) {
  if (!inRoundRect(x, y, 4, 4, 124, 124, 28)) return null;
  if (rects.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1) || inTriangle(x, y, triangle)) {
    return [255, 255, 255];
  }
  const t = (y - 4) / 120;
  return TOP.map((c, i) => Math.round(c + (BOTTOM[i] - c) * t));
}

/** Renders a size×size PNG, with `padding` transparent pixels around the artwork. */
function render(size, padding = 0) {
  const pixels = Buffer.alloc(size * size * 4);
  const scale = 128 / (size - 2 * padding);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, covered = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const color = sample((px - padding + (sx + 0.5) / SAMPLES) * scale, (py - padding + (sy + 0.5) / SAMPLES) * scale);
          if (!color) continue;
          r += color[0]; g += color[1]; b += color[2]; covered++;
        }
      }
      const i = (py * size + px) * 4;
      if (covered) {
        pixels[i] = Math.round(r / covered);
        pixels[i + 1] = Math.round(g / covered);
        pixels[i + 2] = Math.round(b / covered);
        pixels[i + 3] = Math.round((255 * covered) / (SAMPLES * SAMPLES));
      }
    }
  }
  return encodePng(size, size, pixels);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);

  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), body.length + 4);
    return out;
  };

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT_URL, { recursive: true });
for (const size of SIZES) {
  writeFileSync(new URL(`icon${size}.png`, OUT_URL), render(size));
  console.log(`icons/icon${size}.png`);
}

writeFileSync(new URL('../store/store-icon-128.png', import.meta.url), render(128, 16));
console.log('store/store-icon-128.png');
