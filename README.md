# maksim.sh

A terminal-native personal homepage presented as a live inference trace.

The Rust/WebAssembly guest owns a deterministic four-block, eight-channel
fixed-point propagation machine. Its Q8.8 activations and per-edge
contributions are streamed from a Web Worker into xterm.js, while its output
head progressively decodes the homepage content. The visualization is a tiny
purpose-built model, not a general-purpose LLM.

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
