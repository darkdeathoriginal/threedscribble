import test from 'node:test';
import assert from 'node:assert/strict';
import { generateScribble } from '../src/scribble.js';

function fixture(fill = [170, 25, 65, 255]) {
  const width = 24, height = 32;
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  for (let y = 5; y < 27; y++) for (let x = 4; x < 20; x++) data.set(fill, (y * width + x) * 4);
  return { data, width, height };
}
const style = { density: 10, detail: 0, fringe: 0 };

test('valid, deterministic geometry with one RGBA color per vertex', () => {
  const a = generateScribble(fixture(), style);
  const b = generateScribble(fixture(), style);
  assert.ok(a.strokes > 0);
  assert.equal(a.positions.length / 3, a.colors.length / 4);
  assert.equal(a.positions.length, a.segments * 6);
  assert.deepEqual(a.positions, b.positions);
  assert.ok(a.positions.every(Number.isFinite));
  assert.ok(a.colors.every(value => value >= 0 && value <= 1));
});
test('transparent and white source pixels leave no dark rectangle', () => {
  assert.equal(generateScribble(fixture([0, 0, 0, 0]), style).strokes, 0);
  assert.equal(generateScribble(fixture([255, 255, 255, 255]), style).strokes, 0);
});
test('zero depth is flat and increasing depth preserves the front projection', () => {
  const flat = generateScribble(fixture(), { ...style, depth: 0 });
  const deep = generateScribble(fixture(), { ...style, depth: 100 });
  assert.equal(flat.positions.length, deep.positions.length);
  let hasDepth = false;
  for (let i = 0; i < flat.positions.length; i++) {
    if (i % 3 === 2) { assert.equal(Math.abs(flat.positions[i]), 0); if (Math.abs(deep.positions[i]) > 0.1) hasDepth = true; }
    else assert.equal(flat.positions[i], deep.positions[i]);
  }
  assert.ok(hasDepth);
});
test('graphite has equal RGB channels while original color remains red', () => {
  const grey = generateScribble(fixture(), { ...style, color: 0 });
  const red = generateScribble(fixture(), { ...style, color: 100 });
  for (let i = 0; i < grey.colors.length; i += 4) {
    assert.equal(grey.colors[i], grey.colors[i + 1]);
    assert.equal(grey.colors[i], grey.colors[i + 2]);
  }
  assert.ok(red.colors[0] > red.colors[1] * 2);
});
test('density adds strands and loose threads add attached geometry', () => {
  const base = generateScribble(fixture(), style);
  assert.ok(generateScribble(fixture(), { ...style, density: 60 }).strokes > base.strokes);
  assert.ok(generateScribble(fixture(), { ...style, fringe: 100 }).segments > base.segments);
});
test('threshold removes light marks and narrow images still have finite geometry', () => {
  assert.equal(generateScribble(fixture([210, 210, 210, 255]), { ...style, threshold: 60 }).strokes, 0);
  const narrow = generateScribble({ data: new Uint8ClampedArray([0, 0, 0, 255]), width: 1, height: 1 }, style);
  assert.ok(narrow.positions.every(Number.isFinite));
});
