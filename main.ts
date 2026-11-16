// ai-excited-01 entry (Node 22, standard library only).
// The image beside this file, entry.png, is a JPEG (the rules allow a
// PNG or a JPEG, told apart by its first bytes, while the name stays
// entry.png) and is copied byte for byte to /output/entry.png. Before
// copying, the program checks the file is a whole JPEG and fits the
// gate: at most 1 MiB, at most 1024 by 1024 pixels, dimensions read
// from the first Start Of Frame segment. A file that fails a check
// stops the run with an error instead of submitting something the
// gate would refuse. The output directory is created if it does not
// exist yet, and after copying the written file is read back and
// compared byte for byte with the source, so a partial or corrupted
// write fails the run. The copy is deterministic, so both grading runs
// write the identical bytes.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for
// /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, 'entry.png');
const out = join(process.env.MAKEFUN_OUTPUT_DIR ?? '/output', 'entry.png');

const buf = readFileSync(src);

// A JPEG starts with SOI (FF D8) and ends with EOI (FF D9).
if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) {
  throw new Error('entry.png is not a JPEG file (no SOI marker)');
}
if (buf[buf.length - 2] !== 0xff || buf[buf.length - 1] !== 0xd9) {
  throw new Error('entry.png has no EOI marker, the file looks truncated');
}

// Walk the marker segments to the first Start Of Frame segment, which
// holds the dimensions: height then width, big-endian, at offset +5
// from the segment's marker. Standalone markers (SOI, TEM, RSTn) carry
// no length field; every other segment's length includes its own two
// length bytes. SOF0/SOF1/SOF2 (C0/C1/C2) and the other frame markers
// (C0-CF except C4 DHT, C8 JPG, CC DAC) all carry dimensions.
let width = 0;
let height = 0;
let i = 2;
while (i + 9 <= buf.length) {
  if (buf[i] !== 0xff) {
    throw new Error(`entry.png: expected a marker at offset ${i}`);
  }
  const marker = buf[i + 1];
  if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
    i += 2;
    continue;
  }
  const len = buf.readUInt16BE(i + 2);
  if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
    height = buf.readUInt16BE(i + 5);
    width = buf.readUInt16BE(i + 7);
    break;
  }
  i += 2 + len;
}
if (!width || !height) {
  throw new Error('entry.png: no Start Of Frame segment found');
}
if (width > 1024 || height > 1024) {
  throw new Error(`entry.png is ${width}x${height}, over the 1024x1024 gate`);
}
if (buf.length > 1048576) {
  throw new Error(`entry.png is ${buf.length} bytes, over the 1 MiB gate`);
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, buf);
// Read the written file back and confirm it matches the source bytes
// exactly; a partial or corrupted write fails the run instead of
// submitting bytes the gate would refuse.
if (!readFileSync(out).equals(buf)) {
  throw new Error(`read-back check failed: ${out} differs from entry.png`);
}
console.log(`wrote ${out} (${width}x${height}, ${buf.length} bytes)`);
