import { generateScribble } from './scribble.js';

self.onmessage = ({ data }) => {
  try {
    const result = generateScribble(data.image, data.settings);
    self.postMessage(result, [result.positions.buffer, result.colors.buffer]);
  } catch (error) {
    self.postMessage({ error: error.message || 'Unable to generate this drawing.' });
  }
};
