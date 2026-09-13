// Match complete paths, rather than fading independent image layers. Every
// target has identical topology, so one GPU drawing can reshape the same lines.
export function createSharedStrands(items, { maxStrands = 36000, steps = 10 } = {}) {
  const count = Math.min(maxStrands, Math.max(0, ...items.map(item => item.strokes)));
  const targets = items.map(item => {
    const positions = new Float32Array(count * steps * 6);
    const colors = new Float32Array(count * steps * 8);
    const offsets = item.strokeOffsets;
    // Spatial ordering keeps nearby strands together during a transition.
    const order = Array.from({ length: item.strokes }, (_, i) => i);
    const key = i => {
      const p = offsets[i] * 6;
      const x = Math.max(0, Math.min(255, Math.floor((item.positions[p] + 6) / 12 * 255)));
      const y = Math.max(0, Math.min(255, Math.floor((item.positions[p + 1] + 6) / 12 * 255)));
      let code = 0;
      for (let b = 0; b < 8; b++) code |= ((x >> b) & 1) << (b * 2) | ((y >> b) & 1) << (b * 2 + 1);
      // Keep expressive fringe paths matched with other fringe paths.
      return code + (item.colors[offsets[i] * 8 + 3] < 0.999 ? 65536 : 0);
    };
    const keys = order.map(key);
    order.sort((a, b) => keys[a] - keys[b] || a - b);
    for (let strand = 0; strand < count; strand++) {
      if (!order.length) continue;
      const source = order[Math.min(order.length - 1, Math.floor((strand + 0.5) / count * order.length))];
      const start = offsets[source], length = offsets[source + 1] - start;
      for (let step = 0; step < steps; step++) {
        for (let end = 0; end < 2; end++) {
          const t = (step + end) / steps * length;
          const segment = Math.min(length - 1, Math.floor(t));
          const mix = t - segment;
          const vertex = (strand * steps + step) * 2 + end;
          for (let c = 0; c < 3; c++) {
            const p = (start + segment) * 6 + c;
            positions[vertex * 3 + c] = item.positions[p] * (1 - mix) + item.positions[p + 3] * mix;
          }
          for (let c = 0; c < 4; c++) {
            const p = (start + segment) * 8 + c;
            colors[vertex * 4 + c] = item.colors[p] * (1 - mix) + item.colors[p + 4] * mix;
          }
        }
      }
    }
    return { id: item.id, name: item.name, positions, colors };
  });
  return { targets, strokes: count, segments: count * steps };
}
