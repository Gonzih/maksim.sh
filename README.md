# maksim.sh

A terminal-native personal homepage presented as a live inference trace.

The Rust/WebAssembly guest owns a deterministic four-block, eight-channel
fixed-point propagation machine. Its Q8.8 activations and per-edge
contributions are streamed from a Web Worker into xterm.js, while its output
head progressively decodes the homepage content. The visualization is a tiny
purpose-built model, not a general-purpose LLM.

The history graph is rasterized in Rust/WASM using btop's paired-sample model:
two adjacent scalar samples are quantized to four vertical levels each, then
encoded as one Unicode Braille cell through a 5×5 lookup. Positive and negative
contributions use mirrored up/down tables. xterm.js only applies ANSI color and
paints the returned rows.

## Run locally

```sh
npm install
npm run dev
```

## Build

```sh
npm run build
npm run preview
```

The page starts itself: after the WASM guest is ready, the terminal types and
runs `infer identity.weights --trace` without requiring a click.
