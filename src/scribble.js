// Pure, deterministic geometry generation. Runs in a worker so sliders and the
// camera remain responsive while a new drawing is being prepared.
export const DEFAULT_SETTINGS = Object.freeze({ density: 70, detail: 80, depth: 60, flow: 45, fringe: 50, color: 100, threshold: 6 });
export const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const noise = (x, y, seed = 0) => {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
  return n - Math.floor(n);
};
const linear = (v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;

export function generateScribble({ data, width, height }, options = {}) {
  const settings = { ...DEFAULT_SETTINGS, ...options };
  if (!width || !height || data.length !== width * height * 4) throw new Error('Invalid image pixels.');
  const count = width * height;
  const luma = new Float32Array(count);
  const rgb = new Float32Array(count * 3);
  const gx = new Float32Array(count);
  const gy = new Float32Array(count);
  const edges = new Float32Array(count);
  const colorMix = settings.color / 100;
  for (let i = 0; i < count; i++) {
    const alpha = data[i * 4 + 3] / 255;
    const color = [0, 1, 2].map(c => data[i * 4 + c] / 255 * alpha + 1 - alpha);
    const light = color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722;
    luma[i] = light;
    for (let c = 0; c < 3; c++) rgb[i * 3 + c] = linear(clamp(light * (1 - colorMix) + color[c] * colorMix, 0, 1));
  }
  const index = (x, y) => clamp(Math.round(y), 0, height - 1) * width + clamp(Math.round(x), 0, width - 1);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      gx[i] = (luma[index(x + 1, y)] - luma[index(x - 1, y)]) * 0.5;
      gy[i] = (luma[index(x, y + 1)] - luma[index(x, y - 1)]) * 0.5;
      edges[i] = Math.min(1, Math.hypot(gx[i], gy[i]) * 4);
    }
  }
  const positions = [];
  const colors = [];
  const strokeOffsets = [0];
  const bounds = Math.max(width, height);
  const scale = 8 / bounds;
  const cutoff = settings.threshold / 100;
  const depth = settings.depth / 100 * 3.4;
  const flow = settings.flow / 100;
  const detail = settings.detail / 100;
  let strokes = 0;
  // Independent of pixel resolution, with density increasing toward the right.
  const spacing = bounds / (75 + settings.density * 1.5);
  const point = (x, y, layer, phase, t, loose = false) => {
    const nx = (x / width - 0.5) * 2;
    const ny = (y / height - 0.5) * 2;
    const bulge = Math.max(0, 1 - nx * nx - ny * ny);
    const z = depth * (bulge * 0.52 + layer * 0.28 + Math.sin(x / bounds * 8 + phase) * Math.cos(y / bounds * 7 + phase) * 0.17 + Math.sin(t * Math.PI) * (loose ? 0.8 : 0.025));
    return [(x - width / 2) * scale, (height / 2 - y) * scale, z - depth * 0.25];
  };
  const segment = (a, b, ca, cb, alphaA = 1, alphaB = 1) => {
    positions.push(...a, ...b);
    colors.push(...ca, alphaA, ...cb, alphaB);
  };
  const colorAt = (i, darken = 1) => [rgb[i * 3] * darken, rgb[i * 3 + 1] * darken, rgb[i * 3 + 2] * darken];

  const trace = (sx, sy, seed, contour = false) => {
    const start = index(sx, sy);
    const darkness = 1 - luma[start];
    if (darkness < cutoff || noise(sx, sy, seed + 91) > Math.min(0.99, 0.3 + darkness * 1.15 + edges[start])) return;
    let angle = contour ? Math.atan2(gy[start], gx[start]) + Math.PI / 2 : noise(sx, sy, seed) * Math.PI * 2;
    const phase = noise(sx, sy, seed + 7) * Math.PI * 2;
    const layer = noise(sx, sy, seed + 12) - 0.5;
    const steps = contour ? 9 : 7;
    const length = (contour ? 2 + edges[start] * 8 : 2 + darkness * 3 + flow * 5) * bounds / 500;
    const step = length / steps;
    let x = sx, y = sy;
    let previous = point(x, y, layer, phase, 0);
    let previousColor = colorAt(start, contour ? 0.78 : 0.92);
    let added = false;
    for (let s = 1; s <= steps; s++) {
      const i = index(x, y);
      if (edges[i] > 0.05) {
        let target = Math.atan2(gy[i], gx[i]) + Math.PI / 2;
        if (Math.cos(target - angle) < 0) target += Math.PI;
        angle += Math.atan2(Math.sin(target - angle), Math.cos(target - angle)) * (contour ? 0.6 : 0.2);
      }
      angle += Math.sin(phase + s * 0.65) * flow * (contour ? 0.12 : 0.55);
      x += Math.cos(angle) * step;
      y += Math.sin(angle) * step;
      if (x < 0 || y < 0 || x >= width || y >= height) break;
      const next = index(x, y);
      if (1 - luma[next] < cutoff) break;
      const p = point(x, y, layer, phase, s / steps);
      const color = colorAt(next, contour ? 0.78 : 0.92);
      segment(previous, p, previousColor, color);
      previous = p;
      previousColor = color;
      added = true;
    }
    if (added) { strokes++; strokeOffsets.push(positions.length / 6); }
  };
  for (let layer = 0; layer < 3; layer++) {
    for (let y = spacing / 2; y < height; y += spacing) {
      for (let x = spacing / 2; x < width; x += spacing) {
        trace(clamp(x + (noise(x, y, layer) - 0.5) * spacing, 0, width - 1), clamp(y + (noise(y, x, layer + 5) - 0.5) * spacing, 0, height - 1), layer * 23);
      }
    }
  }
  if (detail > 0) {
    const detailStep = Math.max(0.8, spacing * (1.3 - detail * 0.7));
    for (let y = 1; y < height - 1; y += detailStep) {
      for (let x = 1; x < width - 1; x += detailStep) {
        if (edges[index(x, y)] > 0.025 + (1 - detail) * 0.15) trace(x, y, 301, true);
      }
    }
  }
  // Long, loose filaments stay attached to a source feature, but arc out of
  // the image plane. Their tips fade into the white gallery background.
  if (settings.fringe > 0) {
    const step = bounds / 95;
    for (let y = step; y < height - step; y += step) {
      for (let x = step; x < width - step; x += step) {
        const i = index(x, y);
        if (1 - luma[i] < Math.max(cutoff, 0.18) || noise(x, y, 900) > settings.fringe / 100 * (edges[i] > 0.035 ? 0.85 : 0.12)) continue;
        const phase = noise(x, y, 901) * Math.PI * 2;
        const angle = noise(x, y, 902) > 0.3 ? Math.PI / 2 + (noise(x, y, 903) - 0.5) * 0.45 : phase;
        const length = bounds * (0.025 + noise(x, y, 904) * 0.18) * (0.4 + flow);
        const bend = (noise(x, y, 905) - 0.5) * length * 0.55;
        const baseColor = colorAt(i);
        let p = point(x, y, 0, phase, 0, true);
        let alpha = 0.65;
        for (let s = 1; s <= 14; s++) {
          const t = s / 14;
          const px = x + Math.cos(angle) * length * t + Math.cos(angle + Math.PI / 2) * Math.sin(t * Math.PI) * bend;
          const py = y + Math.sin(angle) * length * t + Math.sin(angle + Math.PI / 2) * Math.sin(t * Math.PI) * bend;
          const next = point(px, py, t * (noise(x, y, 906) - 0.5) * 2, phase, t, true);
          const nextAlpha = 0.65 * (1 - t * t);
          segment(p, next, baseColor, baseColor, alpha, nextAlpha);
          p = next; alpha = nextAlpha;
        }
        strokes++;
        strokeOffsets.push(positions.length / 6);
      }
    }
  }
  return { positions: new Float32Array(positions), colors: new Float32Array(colors), strokeOffsets: new Uint32Array(strokeOffsets), strokes, segments: positions.length / 6, width, height };
}
