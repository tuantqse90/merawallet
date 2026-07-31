// Generates the extension icons (16/32/48/128) without any image dependency:
// rasterizes the mark in pure math at 4x supersampling and PNG-encodes with node:zlib.
// Mark = the Mera "M": one continuous route polyline with round caps/joins, endpoint
// nodes at both feet, and a mint spark in the letter's notch — white on the
// Monad-violet tile (mirrors <Mark/> in src/shared/ui.tsx; keep the two in sync).
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

// --- geometry (unit square, mirrors the 128-viewBox SVG /128) ---------------
// M polyline: (26,98) (26,34) (64,72) (102,34) (102,98)
const M_POINTS = [
  [0.203, 0.766],
  [0.203, 0.266],
  [0.5, 0.5625],
  [0.797, 0.266],
  [0.797, 0.766],
];
const STROKE = 0.102; // 13/128
const NODE_R = 0.086; // 11/128 — feet nodes
const SPARK = { x: 0.5, y: 0.344, r: 0.0547 }; // 7/128 mint dot in the notch
const TILE_R = 0.227; // corner radius fraction (NT favicon: 116/512)

const distSeg = (px, py, [ax, ay], [bx, by]) => {
  const vx = bx - ax, vy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)));
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
};

// Vertical brand gradient #9B86FF -> #5538C8 across the tile.
const TOP = [0x9b, 0x86, 0xff];
const BOT = [0x55, 0x38, 0xc8];
const MINT = [0x2c, 0xed, 0xac];

function shade(x, y) {
  // rounded-rect coverage
  const r = TILE_R;
  const cx = Math.min(Math.max(x, r), 1 - r);
  const cy = Math.min(Math.max(y, r), 1 - r);
  if (Math.hypot(x - cx, y - cy) > r) return [0, 0, 0, 0];

  const mix = y;
  let [R, G, B] = TOP.map((t, i) => Math.round(t + (BOT[i] - t) * mix));

  // mint spark wins over everything inside the tile
  if (Math.hypot(x - SPARK.x, y - SPARK.y) <= SPARK.r) {
    return [...MINT, 255];
  }

  // white M: stroke along the polyline (round caps/joins fall out of distSeg) + feet nodes
  let dM = Infinity;
  for (let i = 0; i < M_POINTS.length - 1; i++) {
    dM = Math.min(dM, distSeg(x, y, M_POINTS[i], M_POINTS[i + 1]));
  }
  const feet = Math.min(
    Math.hypot(x - M_POINTS[0][0], y - M_POINTS[0][1]),
    Math.hypot(x - M_POINTS[4][0], y - M_POINTS[4][1]),
  );
  if (dM <= STROKE / 2 || feet <= NODE_R) {
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
