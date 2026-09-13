import test from 'node:test';
import assert from 'node:assert/strict';
import { revealLayout, revealWeights, shortestTurn } from '../src/collection.js';
import { getVideoFormat, recordCanvas } from '../src/recording.js';

test('every source has a distinct reveal direction in the same shared volume', () => {
  for (const count of [1, 2, 3, 4, 7, 12, 25]) {
    const layout = revealLayout(count);
    assert.equal(new Set(layout.map(view => view.imageIndex)).size, count);
    for (const view of layout) {
      const weights = revealWeights(layout, view.angle);
      const best = weights.indexOf(Math.max(...weights));
      assert.equal(layout[best].imageIndex, view.imageIndex);
      assert.ok(weights[best] > 0.999);
      assert.ok(Math.abs(weights.reduce((a, b) => a + b, 0) - 1) < 1e-10);
    }
  }
});

test('reveal transitions stay continuous across a full turn, including the seam', () => {
  const layout = revealLayout(4);
  assert.deepEqual(revealLayout(0), []);
  for (const angle of [0, 0.3, Math.PI / 4, Math.PI, Math.PI * 2]) {
    const left = revealWeights(layout, angle - 0.0001);
    const right = revealWeights(layout, angle + 0.0001);
    left.forEach((value, index) => assert.ok(Math.abs(value - right[index]) < 0.002));
  }
  assert.ok(Math.abs(shortestTurn(350 * Math.PI / 180, 10 * Math.PI / 180) - 20 * Math.PI / 180) < 1e-10);
  assert.deepEqual(revealLayout(2).map(view => view.imageIndex), [0, 1, 0, 1]);
});

test('select an actual supported video container and handle unsupported browsers', () => {
  assert.equal(getVideoFormat(null), null);
  assert.equal(getVideoFormat({ isTypeSupported: () => false }), null);
  assert.equal(getVideoFormat({ isTypeSupported: type => type.startsWith('video/mp4') }).extension, 'mp4');
  assert.equal(getVideoFormat({ isTypeSupported: type => type === 'video/webm;codecs=vp8' }).extension, 'webm');
});

test('recording completes a full orbit, yields a video blob, and releases tracks; cancellation also releases tracks', async () => {
  const keys = ['MediaRecorder', 'document', 'requestAnimationFrame', 'cancelAnimationFrame'];
  const previous = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  let tick, stopped = 0, lastFrame = -1;
  class Recorder {
    static isTypeSupported(type) { return type === 'video/webm'; }
    constructor(stream, options) { this.mimeType = options.mimeType; this.state = 'inactive'; }
    start() { this.state = 'recording'; }
    stop() {
      this.state = 'inactive';
      this.ondataavailable({ data: new Blob(['encoded video']) });
      this.onstop();
    }
  }
  Object.assign(globalThis, {
    MediaRecorder: Recorder,
    document: { addEventListener() {}, removeEventListener() {} },
    requestAnimationFrame: callback => { tick = callback; return 1; },
    cancelAnimationFrame() {},
  });
  const canvas = { captureStream: () => ({ getTracks: () => [{ stop: () => stopped++ }] }) };
  try {
    const complete = recordCanvas(canvas, { duration: 6, onFrame: fraction => lastFrame = fraction, onProgress() {} });
    tick(performance.now() + 6100);
    const result = await complete.promise;
    assert.equal(lastFrame, 1);
    assert.equal(result.extension, 'webm');
    assert.ok(result.blob.size > 0);
    assert.equal(stopped, 1);
    const cancelled = recordCanvas(canvas, { duration: 6, onFrame() {}, onProgress() {} });
    cancelled.cancel();
    await assert.rejects(cancelled.promise, { name: 'AbortError' });
    assert.equal(stopped, 2);
  } finally {
    keys.forEach((key, index) => { if (previous[index]) Object.defineProperty(globalThis, key, previous[index]); else delete globalThis[key]; });
  }
});
