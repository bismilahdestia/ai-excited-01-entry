// Whale breaching through a ring of fire at sunset.
// Draws a 1024x1024 PNG procedurally with a tiny software rasterizer
// and a hand-rolled PNG encoder. Standard library only, fully
// deterministic: two runs produce byte-identical files.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32)
// ---------------------------------------------------------------------------
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20261116);

// ---------------------------------------------------------------------------
// Pixel buffer + helpers
// ---------------------------------------------------------------------------
const buf = new Uint8Array(W * H * 3);

type RGB = [number, number, number];

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function mix(c1: RGB, c2: RGB, t: number): RGB {
  return [
    Math.round(lerp(c1[0], c2[0], t)),
    Math.round(lerp(c1[1], c2[1], t)),
    Math.round(lerp(c1[2], c2[2], t)),
  ];
}

// Set a pixel with alpha blending (alpha 0..1).
function setPixel(x: number, y: number, r: number, g: number, b: number, a = 1): void {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix < 0 || ix >= W || iy < 0 || iy >= H) return;
  const o = (iy * W + ix) * 3;
  if (a >= 1) {
    buf[o] = r;
    buf[o + 1] = g;
    buf[o + 2] = b;
  } else if (a > 0) {
    buf[o] = Math.round(buf[o] * (1 - a) + r * a);
    buf[o + 1] = Math.round(buf[o + 1] * (1 - a) + g * a);
    buf[o + 2] = Math.round(buf[o + 2] * (1 - a) + b * a);
  }
}

function fillDisc(cx: number, cy: number, rad: number, color: RGB, a = 1): void {
  const r = Math.ceil(rad);
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y <= rad * rad) {
        setPixel(cx + x, cy + y, color[0], color[1], color[2], a);
      }
    }
  }
}

// Filled ellipse rotated by `angle` radians.
function fillRotatedEllipse(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  angle: number,
  color: RGB,
  a = 1,
): void {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const r = Math.ceil(Math.max(rx, ry));
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      const px = (x * cos + y * sin) / rx;
      const py = (-x * sin + y * cos) / ry;
      if (px * px + py * py <= 1) {
        setPixel(cx + x, cy + y, color[0], color[1], color[2], a);
      }
    }
  }
}

// Thick line segment drawn as a chain of small discs.
function drawLine(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  width: number,
  color: RGB,
  a = 1,
): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(len));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    fillDisc(x0 + dx * t, y0 + dy * t, width / 2, color, a);
  }
}

// Filled triangle (barycentric test over its bounding box).
function fillTriangle(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  color: RGB,
  a = 1,
): void {
  const minX = Math.floor(Math.min(ax, bx, cx));
  const maxX = Math.ceil(Math.max(ax, bx, cx));
  const minY = Math.floor(Math.min(ay, by, cy));
  const maxY = Math.ceil(Math.max(ay, by, cy));
  const d = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  if (d === 0) return;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const w0 = ((bx - x) * (cy - y) - (by - y) * (cx - x)) / d;
      const w1 = ((cx - x) * (ay - y) - (cy - y) * (ax - x)) / d;
      const w2 = 1 - w0 - w1;
      if (w0 >= 0 && w1 >= 0 && w2 >= 0) {
        setPixel(x, y, color[0], color[1], color[2], a);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Sky: deep indigo -> magenta -> burning orange vertical gradient
// ---------------------------------------------------------------------------
const SKY_TOP: RGB = [16, 10, 54];
const SKY_MID: RGB = [122, 28, 96];
const SKY_LOW: RGB = [255, 122, 26];
const HORIZON = 700;

for (let y = 0; y < HORIZON; y++) {
  const t = y / HORIZON;
  const c = t < 0.55 ? mix(SKY_TOP, SKY_MID, t / 0.55) : mix(SKY_MID, SKY_LOW, (t - 0.55) / 0.45);
  for (let x = 0; x < W; x++) {
    const o = (y * W + x) * 3;
    buf[o] = c[0];
    buf[o + 1] = c[1];
    buf[o + 2] = c[2];
  }
}

// Faint stars high in the sky.
for (let i = 0; i < 110; i++) {
  const sx = rand() * W;
  const sy = rand() * 260;
  const bright = 140 + Math.floor(rand() * 115);
  const alpha = 0.25 + rand() * 0.6;
  const size = rand() < 0.12 ? 2 : 1;
  fillDisc(sx, sy, size, [bright, bright, 255], alpha);
}

// ---------------------------------------------------------------------------
// Sun: glow, bright disc, and a thin ring of fire around it
// ---------------------------------------------------------------------------
const SUN_X = 512;
const SUN_Y = 452;
const SUN_R = 148;

// Wide warm glow, drawn as concentric ring bands.
for (let r = 360; r > 0; r -= 2) {
  const t = 1 - r / 360;
  const alpha = 0.34 * t * t;
  const c = mix([255, 90, 20], [255, 190, 80], t);
  for (let a = 0; a < 360; a += 1) {
    const rad = (a * Math.PI) / 180;
    const px = SUN_X + Math.cos(rad) * r;
    const py = SUN_Y + Math.sin(rad) * r;
    setPixel(px, py, c[0], c[1], c[2], alpha * 0.5);
  }
}

// Sun disc: hot core fading to deep orange at the edge.
// Filled per pixel so there are no polar-sampling gaps or moire.
for (let y = SUN_Y - SUN_R; y <= SUN_Y + SUN_R; y++) {
  for (let x = SUN_X - SUN_R; x <= SUN_X + SUN_R; x++) {
    const dist = Math.hypot(x - SUN_X, y - SUN_Y);
    if (dist > SUN_R) continue;
    const t = dist / SUN_R;
    const c = mix([255, 246, 214], [255, 140, 30], t * t);
    setPixel(x, y, c[0], c[1], c[2], 1);
  }
}

// Ring of fire: a thin annulus with a seeded, flickering outer edge.
const RING_R = 178;
const flicker: number[] = [];
for (let i = 0; i < 720; i++) flicker.push(rand());
for (let a = 0; a < 720; a++) {
  const ang = (a / 720) * Math.PI * 2;
  const wobble = (flicker[a] - 0.5) * 26;
  const outer = RING_R + 16 + wobble;
  const inner = RING_R - 12;
  for (let r = inner; r <= outer; r += 1) {
    const t = (r - inner) / (outer - inner);
    const c = mix([255, 220, 90], [255, 70, 10], t);
    const px = SUN_X + Math.cos(ang) * r;
    const py = SUN_Y + Math.sin(ang) * r;
    setPixel(px, py, c[0], c[1], c[2], 0.95);
  }
}
// Bright inner edge of the ring so it reads as fire, not a flat band.
for (let a = 0; a < 720; a++) {
  const ang = (a / 720) * Math.PI * 2;
  const px = SUN_X + Math.cos(ang) * (RING_R - 12);
  const py = SUN_Y + Math.sin(ang) * (RING_R - 12);
  setPixel(px, py, 255, 240, 160, 1);
}

// ---------------------------------------------------------------------------
// Sea: dark water with a shimmering sun reflection
// ---------------------------------------------------------------------------
const SEA_TOP: RGB = [24, 16, 66];
const SEA_BOT: RGB = [6, 6, 26];
for (let y = HORIZON; y < H; y++) {
  const t = (y - HORIZON) / (H - HORIZON);
  const c = mix(SEA_TOP, SEA_BOT, t);
  for (let x = 0; x < W; x++) {
    const o = (y * W + x) * 3;
    buf[o] = c[0];
    buf[o + 1] = c[1];
    buf[o + 2] = c[2];
  }
}

// Sun reflection: horizontal shimmering bands, widest near the horizon,
// narrowing and fading as they run down the water.
for (let i = 0; i < 90; i++) {
  const t = rand();
  const y = HORIZON + 6 + t * t * (H - HORIZON - 20);
  const spread = lerp(150, 34, t);
  const cx = SUN_X + (rand() - 0.5) * spread * 0.7;
  const half = spread * (0.35 + rand() * 0.65);
  const alpha = (0.5 - t * 0.32) * (0.4 + rand() * 0.6);
  const warm: RGB = rand() < 0.75 ? [255, 150, 50] : [255, 210, 120];
  drawLine(cx - half, y, cx + half, y, 2 + rand() * 3, warm, alpha);
}

// A few long swell lines for depth.
for (let i = 0; i < 14; i++) {
  const y = HORIZON + 30 + i * 20 + rand() * 8;
  const x0 = rand() * 300;
  const len = 140 + rand() * 420;
  drawLine(x0, y, x0 + len, y + (rand() - 0.5) * 4, 2, [70, 90, 160], 0.25 + rand() * 0.2);
}

// ---------------------------------------------------------------------------
// The whale: a huge dark silhouette arcing out of the water, head high
// toward the sun ring, tail still in the sea.
// ---------------------------------------------------------------------------
const WHALE: RGB = [10, 8, 30];

// Main body: long ellipse tilted so the head rises to the upper right.
fillRotatedEllipse(500, 628, 300, 108, -0.58, WHALE, 1);
// Head mass: a rounder ellipse at the upper-right end.
fillRotatedEllipse(700, 500, 150, 105, -0.58, WHALE, 1);
// Throat / belly taper toward the tail.
fillRotatedEllipse(330, 700, 130, 80, -0.58, WHALE, 1);

// Tail stock and flukes, still low near the water.
fillRotatedEllipse(238, 742, 92, 42, -0.9, WHALE, 1);
fillTriangle(196, 716, 96, 660, 150, 742, WHALE, 1);
fillTriangle(196, 716, 108, 800, 168, 748, WHALE, 1);

// Pectoral fin sweeping down into the water.
fillRotatedEllipse(560, 700, 96, 30, 0.85, WHALE, 1);

// Sunlit rim light along the whale's upper edge: a bright orange arc that
// follows the body's top curve, drawn as connected segments so it reads
// as one continuous glowing line.
const rimSteps = 160;
let prevX = 0;
let prevY = 0;
for (let i = 0; i <= rimSteps; i++) {
  const t = i / rimSteps;
  const ang = Math.PI * (1.05 + t * 0.85); // upper arc of the body ellipse
  const ex = Math.cos(ang) * 300;
  const ey = Math.sin(ang) * 108;
  const cos = Math.cos(-0.58);
  const sin = Math.sin(-0.58);
  const px = 500 + ex * cos - ey * sin;
  const py = 628 + ex * sin + ey * cos;
  const glow = 0.55 + 0.45 * Math.sin(t * Math.PI);
  if (i > 0) {
    drawLine(prevX, prevY, px, py, 4, [255, 170, 70], 0.85 * glow);
    drawLine(prevX, prevY, px, py, 1.8, [255, 225, 150], 0.9 * glow);
  }
  prevX = px;
  prevY = py;
}

// Eye glint: one tiny bright dot on the head.
fillDisc(742, 462, 4, [255, 220, 140], 0.95);
fillDisc(742, 462, 2, [255, 250, 220], 1);

// ---------------------------------------------------------------------------
// Spray: a crown of droplets where the whale leaves the water, plus a
// burst around the tail. All positions come from the seeded PRNG.
// ---------------------------------------------------------------------------
function sprayBurst(cx: number, cy: number, count: number, spreadX: number, spreadY: number): void {
  for (let i = 0; i < count; i++) {
    const ang = -Math.PI / 2 + (rand() - 0.5) * Math.PI * 1.4;
    const dist = Math.pow(rand(), 0.6);
    const px = cx + Math.cos(ang) * dist * spreadX;
    const py = cy + Math.sin(ang) * dist * spreadY;
    const size = 1 + rand() * 3.2;
    const alpha = 0.35 + rand() * 0.6;
    const c: RGB = rand() < 0.7 ? [235, 245, 255] : [255, 210, 150];
    fillDisc(px, py, size, c, alpha);
  }
}

sprayBurst(330, 706, 260, 190, 130); // breach crown
sprayBurst(210, 730, 150, 130, 90); // tail burst
sprayBurst(620, 690, 60, 120, 60); // droplets along the belly

// A few arcing spray streaks rising from the breach point, kept short
// and low so they stay in the water and spray zone, not across the body.
for (let i = 0; i < 16; i++) {
  const a0 = -Math.PI * (0.15 + rand() * 0.7);
  const len = 30 + rand() * 55;
  const x0 = 280 + (rand() - 0.5) * 130;
  const y0 = 706 + (rand() - 0.5) * 16;
  drawLine(
    x0,
    y0,
    x0 + Math.cos(a0) * len,
    y0 + Math.sin(a0) * len,
    1.5 + rand() * 1.5,
    [220, 235, 255],
    0.3 + rand() * 0.45,
  );
}

// ---------------------------------------------------------------------------
// Birds: small dark chevrons high in the sky, away from the sun.
// ---------------------------------------------------------------------------
function bird(x: number, y: number, s: number): void {
  drawLine(x - s, y, x, y - s * 0.55, 2.5, [20, 14, 44], 0.9);
  drawLine(x, y - s * 0.55, x + s, y, 2.5, [20, 14, 44], 0.9);
}

bird(180, 210, 16);
bird(250, 160, 12);
bird(300, 250, 10);
bird(830, 180, 14);
bird(890, 250, 11);
bird(760, 120, 9);

// ---------------------------------------------------------------------------
// PNG encoder (hand-rolled): signature, IHDR, IDAT (zlib), IEND, CRC32.
// ---------------------------------------------------------------------------
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}

function crc32(data: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type 2 = RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter type 0 (None)
    raw.set(buf.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Write + read-back verification
// ---------------------------------------------------------------------------
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'entry.png');
const png = encodePNG();
writeFileSync(outPath, png);

const back = readFileSync(outPath);
if (!back.equals(png)) {
  throw new Error('read-back verification failed: bytes on disk differ from bytes written');
}
console.log(`wrote ${outPath} (${png.length} bytes)`);
