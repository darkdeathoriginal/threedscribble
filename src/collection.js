// Every image occupies the SAME origin, with its own reveal direction.
// Repeat two-image compositions on the back so a full turn stays readable.
export function revealLayout(count) {
  const views = count === 2 ? 4 : count;
  return Array.from({ length: views }, (_, index) => ({
    imageIndex: index % count,
    angle: index * Math.PI * 2 / views,
  }));
}

export function revealWeights(layout, angle) {
  if (layout.length === 1) return [1];
  const scores = layout.map(view => Math.cos(angle - view.angle));
  const best = Math.max(...scores);
  const sharpness = Math.max(12, layout.length * layout.length * 0.8);
  const weights = scores.map(score => Math.exp((score - best) * sharpness));
  const total = weights.reduce((sum, value) => sum + value, 0);
  return weights.map(value => value / total);
}

export function shortestTurn(from, to) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}
