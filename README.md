# maksim.sh

A continuously animated personal site for Maksim Soltan, a knowledge engineer
who crafts, organizes, and refines knowledge bases for one-shot execution by
agentic systems.

D3 drives a full-screen canvas topology that moves forever through four states:
a semantic graph, an `MS` point cloud, a signal lattice, and a radial flow field.
The graph reacts to pointer movement and emits travelling signals across a live
Delaunay mesh.

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

## Animated social preview

The Open Graph card is a deterministic capture of the live topology. Regenerate
the looping 1200×630 GIF on macOS with Google Chrome and FFmpeg installed:

```sh
npm run social:preview
npm run social:validate
```

The GIF is the primary Open Graph and Twitter image. `public/og.png` remains the
static fallback for crawlers that do not render animation.
