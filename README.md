# maksim.sh

A terminal-native personal homepage built around a real browser/WASM probe.

The xterm.js surface renders live browser scheduler telemetry. Deterministic
Rust kernels run in WebAssembly on both the main thread and a Web Worker. The
worker streams sample records through a SharedArrayBuffer/Atomics ring when
cross-origin isolation is available.

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

The probe reports raw measurements and distributions rather than a composite
device score. Its linear-memory result is explicitly a WebAssembly logical scan,
not a claim about physical RAM bandwidth.
