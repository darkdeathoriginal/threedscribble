// Every image occupies the SAME origin, with its own reveal direction.
// Repeat two-image compositions on the back so a full turn stays readable.
export function revealLayout(count) {
  const views = count === 2 ? 4 : count;
  return Array.from({ length: views }, (_, index) => ({
    imageIndex: index % count,
    angle: index * Math.PI * 2 / views,
  }));
}

export const smooth = t => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };

export function revealPair(layout, angle) {
  if (layout.length < 2) return { from: 0, to: 0, mix: 0 };
  const phase = ((angle / (Math.PI * 2) % 1) + 1) % 1 * layout.length;
  const from = Math.floor(phase) % layout.length;
  return { from, to: (from + 1) % layout.length, mix: smooth((phase - Math.floor(phase) - 0.12) / 0.76) };
}

export function shortestTurn(from, to) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

// Frame, push in, hold detail, pull back, then turn. Shared by live playback
// and export so recorded close-ups follow exactly the same camera path.
export function sampleTour(progress, viewCount = 1, motion = 'cinematic') {
  const count = Math.max(1, viewCount);
  const phase = Math.max(0, Math.min(1, progress)) * count;
  const index = Math.min(count - 1, Math.floor(phase));
  const local = phase - index;
  if (motion === 'orbit') return { angle: progress * Math.PI * 2, zoom: 1, focusY: 0, elevation: 0 };
  const close = smooth((local - 0.12) / 0.24) * (1 - smooth((local - 0.54) / 0.18));
  const turn = smooth((local - 0.74) / 0.26);
  return {
    angle: (index + turn) / count * Math.PI * 2 + Math.sin(local * Math.PI * 2) * close * 0.035,
    zoom: 1 + close * 1.9,
    focusY: close * (0.8 + 0.15 * Math.sin(local * Math.PI * 2)),
    elevation: close * 0.35,
  };
}
