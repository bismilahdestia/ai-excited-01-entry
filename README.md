# Whale through the Ring of Fire

[![make.fun · ai-excited-01](https://make.fun/badge/ai-excited-01.svg)](https://make.fun/bounty/ai-excited-01?utm_source=github&utm_medium=readme&utm_campaign=ai-excited-01)
[![rank](https://make.fun/badge/ai-excited-01/bismilahdestia/ai-excited-01-entry/rank.svg)](https://make.fun/bounty/ai-excited-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=ai-excited-01)
[![reward](https://make.fun/badge/ai-excited-01/bismilahdestia/ai-excited-01-entry/reward.svg)](https://make.fun/bounty/ai-excited-01?utm_source=github&utm_medium=readme&utm_campaign=ai-excited-01)

Entry for the [ai-excited-01 bounty](https://make.fun/bounty/ai-excited-01) — "Make the AI judge excited" ($250).

## The image

A colossal whale breaches through a ring of fire at sunset.

The sky burns from deep indigo at the top, through magenta, down to a
blazing orange horizon. A huge low sun hangs in the middle of the frame,
wrapped in a thin ring of fire whose edge flickers like a real flame. Below
it, a dark sea catches the sun in shimmering bands of reflected light.

And then the whale: a massive dark silhouette arcing clean out of the
water, head high toward the burning sun, tail still in the sea, a crown of
spray bursting where it broke the surface. A warm rim of sunlight traces
the top of its body. A few small birds wheel far away in the upper sky,
and faint stars are already appearing overhead.

One dominant shape — whale and sun ring, locked together — with energy,
awe, surprise, and momentum. It reads at a glance, even as a thumbnail.

## The program

`main.ts` draws the whole image in code — there is no photo, no stock
asset, no downloaded image anywhere in this repo. It contains:

- A tiny software rasterizer: an RGB pixel buffer with alpha blending,
  discs, rotated ellipses, triangles, and thick lines.
- A seeded PRNG (mulberry32), so the spray particles, stars, and the
  flickering edge of the fire ring are random-looking but fully
  deterministic — no `Date`, no `Math.random`, no network.
- A hand-written PNG encoder: signature, IHDR, IDAT (zlib), IEND, and
  CRC32 computed from scratch with the IEEE polynomial.

Everything runs on the Node.js standard library only (`node:fs`,
`node:path`, `node:url`, `node:zlib`). Two runs produce byte-identical
files.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

This writes a 1024×1024 PNG to `out/entry.png` (under 1 MiB), then reads
it back and verifies the bytes on disk match the bytes it wrote.

## License

MIT — see [LICENSE](LICENSE).
