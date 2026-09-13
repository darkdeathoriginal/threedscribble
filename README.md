# 3D Scribble Art

A React and Three.js studio that turns images into navigable, colored 3D thread drawings. Continuous curved strands follow image features, with dense detail and longer expressive filaments extending into space. A clean white canvas, camera presets, close zoom, and an image filmstrip support exploring the artwork.

The geometry is an artistic interpretation. In 3D reveal mode, images use one shared set of continuous strands. A worker matches and resamples complete paths into identical topology; one GPU drawing interpolates their positions and colors as the camera turns. This is a digital morph: the strands reshape, rather than forming a fixed sculpture whose projections reproduce every image. It does not cross-fade separate drawings. Images remain in browser memory for the current session and are processed locally in a Web Worker.

## Features

- Upload multiple images or drop them anywhere: **3D reveal** matches all uploads to shared strands at the same origin (the demo is excluded). Rotate to reshape those strands into another image. Thumbnails turn the camera to each image's viewing angle; they do not separate the images into tiles. Single image is available for isolated inspection.
- Built-in illustrated portrait for quick testing
- Free orbit, pan, cursor-centered zoom, and a cinematic tour with 2.9× detail close-ups, pullbacks, and turns
- Animated front, detail, three-quarter, side, and above camera presets
- Colored curved strands, fine feature tracing, and long loose threads
- Expressive, fine ink, and graphite style presets
- Original-image comparison, fullscreen, and PNG export of the entire current scene
- Export video: record a 6-, 12-, 20-, or 32-second cinematic zoom tour or simple orbit, preview it, and download MP4 when the browser supports it, otherwise WebM. Live playback and cinematic export share the same camera path and strand animation.
- Responsive desktop workspace and expandable controls on mobile
- Worker-based generation with cancellation when images or settings change
- Transparent pixels are composited on white; invalid images are rejected before replacing the drawing

## Tech Stack

- React
- Vite
- Three.js
- Lucide React icons

## Getting Started

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open the local URL printed by Vite. By default this project uses:

```text
http://127.0.0.1:5173/
```

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Controls

- `Strand density`: Increasing it creates more overlapping strands.
- `Fine detail`: Adds smaller strokes that follow image edges and facial features.
- `3D depth`: Spreads strands into a volume; zero flattens the drawing.
- `Stroke looseness`: Changes strand length and curvature.
- `Loose threads`: Adds long, fading filaments around the subject.
- `Original color`: Blends from monochrome graphite to the source colors.
- `White removal`: Omits bright areas; lower values include lighter marks.
- `Cinematic tour`: Frames each image, pushes into its details, pulls back, and turns to the next. Manual dragging or zoom buttons pause playback.
- Drag with one finger or the left mouse button to orbit. Scroll or pinch to zoom. Right-drag, Shift-drag, or use two fingers to pan. Use the reset-camera button to return to the front.

Use JPG, PNG, WebP, or another browser-supported image format, up to 30 MB per image. Processing preserves aspect ratio and samples up to 620 pixels on the longest side. For the clearest isolated drawing, use a subject on a light or transparent background. PNG export saves the current 3D canvas at the displayed rendering resolution.

The **Export video** button is at the top right. Recording runs in real time at a target 30 fps and uses the current canvas resolution. Cinematic mode supplies its own framing and zoom path; Simple orbit preserves the current framing. Camera position and zoom are restored after completion or cancellation. Keep the tab visible until the preview appears; Cancel recording discards the partial recording. No screen, camera, or microphone permissions are required. The browser chooses a supported format through [MediaRecorder.isTypeSupported](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static).

## Verification

```bash
npm test
npm run build
```

Tests cover deterministic geometry, transparency, projection, density, shared path continuity and topology, empty sources, camera close-ups and loop continuity, recording format selection, completion, and cancellation.

## Project Structure

```text
src/
  App.jsx       Uploads, collection, controls, and worker lifecycle
  ScribbleViewport.jsx  Three.js rendering and camera controls
  scribble.js   Pure deterministic strand geometry generation
  scribble.worker.js   Background generation and transferable buffers
  demo.js       Built-in illustrated source image
  main.jsx      React entry point
  styles.css    Application styles and responsive layout
```

Generated files such as `dist/`, `node_modules/`, and verification screenshots are ignored by Git.
