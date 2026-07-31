// Generates the extension icons (16/32/48/128) without any image dependency:
// rasterizes the mark in pure math at 4x supersampling and PNG-encodes with node:zlib.
// Mark = NullTerminal's route glyph (diagonal route through a "null" ring, two endpoint
// nodes) in white on the Monad-violet tile — same geometry as nullterminal's favicon.
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
mkdirSync(OUT, { recursive: true });

// --- PNG encoding -----------------------------------------------------------
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- geometry (unit square coordinates) -------------------------------------
const NODE_A = [0.25, 0.75];
const NODE_B = [0.75, 0.25];
const RING_R = 0.234;
const STROKE = 0.086;
const NODE_R = 0.098;
const TILE_R = 0.227; // corner radius fraction (nullterminal favicon: 116/512)

const distSeg = (px, py, [ax, ay], [bx, by]) => {
  const vx = bx - ax, vy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)));
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
};

// Vertical brand gradient #9B86FF -> #5538C8 across the tile.
const TOP = [0x9b, 0x86, 0xff];
const BOT = [0x55, 0x38, 0xc8];

function shade(x, y) {
  // rounded-rect coverage
  const r = TILE_R;
  const cx = Math.min(Math.max(x, r), 1 - r);
  const cy = Math.min(Math.max(y, r), 1 - r);
  if (Math.hypot(x - cx, y - cy) > r) return [0, 0, 0, 0];

  const mix = y;
  let [R, G, B] = TOP.map((t, i) => Math.round(t + (BOT[i] - t) * mix));

  // white glyph: diagonal route + ring stroke + endpoint nodes
  const dLine = distSeg(x, y, NODE_A, NODE_B);
  const dRing = Math.abs(Math.hypot(x - 0.5, y - 0.5) - RING_R);
  const dNode = Math.min(Math.hypot(x - NODE_A[0], y - NODE_A[1]), Math.hypot(x - NODE_B[0], y - NODE_B[1]));
  if (dLine <= STROKE / 2 || dRing <= STROKE / 2 || dNode <= NODE_R) {
    R = G = B = 255;
  }
  return [R, G, B, 255];
}

function render(size) {
  const SS = 4;
  const big = size * SS;
  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const [pr, pg, pb, pa] = shade((x * SS + sx + 0.5) / big, (y * SS + sy + 0.5) / big);
          r += pr * pa; g += pg * pa; b += pb * pa; a += pa;
        }
      }
      const i = (y * size + x) * 4;
      rgba[i] = a ? Math.round(r / a) : 0;
      rgba[i + 1] = a ? Math.round(g / a) : 0;
      rgba[i + 2] = a ? Math.round(b / a) : 0;
      rgba[i + 3] = Math.round(a / (SS * SS));
    }
  }
  return encodePng(size, rgba);
}

for (const size of [16, 32, 48, 128]) {
  writeFileSync(join(OUT, `icon${size}.png`), render(size));
  console.log(`icon${size}.png`);
}
