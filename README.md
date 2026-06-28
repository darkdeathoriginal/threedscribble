# 3D Scribble Art

A React and Three.js web app that converts an uploaded image into a navigable 3D scribble-style relief drawing. The renderer samples image brightness, color, contrast, and edges, then builds thousands of short colored pencil strokes that can be rotated, zoomed, and exported as a PNG.

## Features

- Upload any local image and convert it in the browser
- Built-in demo portrait for quick testing
- Orbit, zoom, and auto-rotate the 3D drawing
- Colored scribble strokes that preserve source-image hues
- Fine-detail pass for sharper edges and texture
- Tunable line density, ink threshold, color strength, detail, depth, stroke looseness, and layer count
- Download the current canvas view as a PNG
- Responsive layout for desktop and mobile

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

- `Line density`: Controls stroke spacing. Lower values create more strokes.
- `Ink threshold`: Filters lighter image areas. Lower values include more subtle marks.
- `Color strength`: Blends more of the original image color into each stroke.
- `Fine detail`: Adds smaller feature strokes around edges and contrast changes.
- `Depth`: Sets the relief height generated from brightness and edges.
- `Stroke looseness`: Adds hand-drawn variation to stroke direction.
- `Layer count`: Adds more hatching layers for richer drawings.
- `Auto orbit`: Slowly rotates the 3D view.

## Project Structure

```text
src/
  App.jsx       Main app, image processing, and Three.js scene
  main.jsx      React entry point
  styles.css    Application styles and responsive layout
```

Generated files such as `dist/`, `node_modules/`, and verification screenshots are ignored by Git.
