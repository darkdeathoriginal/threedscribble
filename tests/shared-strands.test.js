import test from 'node:test';
import assert from 'node:assert/strict';
import { createSharedStrands } from '../src/shared-strands.js';
import { generateScribble } from '../src/scribble.js';

function drawing(red, size) {
  const data = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let y = 3; y < size - 3; y++) for (let x = 4; x < size - 4; x++) {
    data.set(red ? [180, 20, 40, 255] : [25, 45, 200, 255], (y * size + x) * 4);
  }
  return generateScribble({ data, width: size, height: size }, { density: 10, detail: 0, fringe: 0 });
}

test('all source drawings become the same continuous strand topology with opaque image detail', () => {
  const originals = [drawing(true, 24), drawing(false, 32)];
  const shared = createSharedStrands(originals, { maxStrands: 800, steps: 10 });
  assert.equal(shared.strokes, 800);
  for (const target of shared.targets) {
    assert.equal(target.positions.length, shared.segments * 6);
    assert.equal(target.colors.length, shared.segments * 8);
    assert.ok(target.positions.every(Number.isFinite));
    for (let strand = 0; strand < shared.strokes; strand++) {
      for (let step = 1; step < 10; step++) {
        const p = (strand * 10 + step) * 6;
        assert.deepEqual(target.positions.slice(p - 3, p), target.positions.slice(p, p + 3));
      }
    }
    for (let i = 3; i < target.colors.length; i += 4) assert.equal(target.colors[i], 1);
  }
  assert.notDeepEqual(shared.targets[0].colors, shared.targets[1].colors);
  assert.deepEqual(createSharedStrands(originals, { maxStrands: 800, steps: 10 }), shared);
});

test('path boundaries cover each generated segment and empty images cannot generate NaNs', () => {
  const full = drawing(true, 24);
  assert.equal(full.strokeOffsets.length, full.strokes + 1);
  assert.equal(full.strokeOffsets.at(-1), full.segments);
  const empty = generateScribble({ data: new Uint8ClampedArray(4), width: 1, height: 1 });
  const shared = createSharedStrands([full, empty], { maxStrands: 20 });
  assert.equal(shared.targets[0].positions.length, shared.targets[1].positions.length);
  assert.ok(shared.targets[1].positions.every(Number.isFinite));
  assert.ok(shared.targets[1].colors.every(v => v === 0));
});
