# Make the AI judge excited — ai-excited-01

A program that writes one image to `/output/entry.png`: a colossal ocean
wave curling overhead like a glass cathedral at golden hour, deep teal
water glowing from within, a tiny lone surfer silhouetted on the wave
face for scale, and the wave's crest bursting apart into a flock of
glowing white seabirds flying free — warm amber sunset light against
dark storm clouds.

One bold sweeping curve dominates the whole square frame, so the image
still hits at small sizes: the wave is the idea, the surfer is the scale,
and the birds are the surprise — a crest that turns into wings instead of
just breaking. A fresh, specific moment of awe and momentum, not a stock
explosion, a firework, or a generic action scene.

The image is held in this repository as `entry.png` (1024x1024 JPEG,
281,751 bytes, under the 1 MiB gate). `main.ts` (Node 22, standard library
only) checks it is a whole JPEG within the gate — SOI and EOI markers,
dimensions from the Start Of Frame segment, size — and copies it byte for
byte to the output directory. The copy is deterministic: both grading
runs write the identical bytes.

Run it locally:

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## License

MIT — see `LICENSE`.
