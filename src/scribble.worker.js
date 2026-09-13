import { generateScribble } from './scribble.js';
import { createSharedStrands } from './shared-strands.js';

self.onmessage = ({ data }) => {
  try {
    if (data.items) {
      const result = createSharedStrands(data.items);
      self.postMessage(result, result.targets.flatMap(target => [target.positions.buffer, target.colors.buffer]));
      return;
    }
    const result = generateScribble(data.image, data.settings);
    self.postMessage(result, [result.positions.buffer, result.colors.buffer, result.strokeOffsets.buffer]);
  } catch (error) {
    self.postMessage({ error: error.message || 'Unable to generate this drawing.' });
  }
};
