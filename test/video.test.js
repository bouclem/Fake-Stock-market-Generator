import test from 'node:test';
import assert from 'node:assert/strict';
import { generateStock, renderVideoChart } from '../src/index.js';
import { Framebuffer } from '../src/framebuf.js';

const OPTS = { seed: 'video-test', startDate: '2024-01-02', bars: 30, interval: '1d' };

function stocks(n = 3) {
  return Array.from({ length: n }, (_, i) => generateStock({
    symbol: `V${i + 1}`,
    ...OPTS,
    startPrice: 50 + i * 40,
    sharesOutstanding: 1_000_000 * (i + 1)
  }));
}

// ---- validation ----

test('rejects empty input', async () => {
  await assert.rejects(() => renderVideoChart([], { seconds: 1 }), /non-empty/);
  await assert.rejects(() => renderVideoChart(null, { seconds: 1 }), /non-empty/);
});

test('rejects stocks without worth (valuations only)', async () => {
  const s = generateStock({ symbol: 'NP', ...OPTS }); // no sharesOutstanding → no worth
  await assert.rejects(() => renderVideoChart([s], { seconds: 1 }), /valuations only/);
  await assert.rejects(() => renderVideoChart([s], { seconds: 1 }), /sharesOutstanding/);
});

test('rejects stocks with no bars', async () => {
  await assert.rejects(
    () => renderVideoChart([{ symbol: 'E', bars: [] }], { seconds: 1 }),
    /no bars/
  );
});

// ---- framebuffer ----

test('framebuffer draws primitives', () => {
  const fb = new Framebuffer(32, 32).fill('#000000');
  fb.set(5, 5, '#ff0000');
  const i = (5 * 32 + 5) * 3;
  assert.deepEqual([fb.data[i], fb.data[i + 1], fb.data[i + 2]], [255, 0, 0]);
  fb.fillRect(0, 0, 32, 32, '#00ff00');
  assert.equal(fb.data[i], 0);
  assert.equal(fb.data[i + 1], 255);
  fb.text(1, 1, 'AB', '#ffffff');
  const w2 = fb.textWidth('AB');
  const w1 = fb.textWidth('A');
  assert.ok(w2 > w1 && w1 > 0, 'vector textWidth should grow with content');
  // alpha-blended fillRect
  fb.fill('#000000').fillRect(0, 0, 4, 4, '#ffffff', 0.5);
  assert.ok(fb.data[0] > 100 && fb.data[0] < 155, '50% white over black ≈ 128');
});

// ---- real encode ----

test('produces a real .mp4 (h264)', async (t) => {
  let hasEncoder = true;
  try { await import('h264-mp4-encoder'); } catch { hasEncoder = false; }
  if (!hasEncoder) return t.skip('h264-mp4-encoder not installed');

  const mp4 = await renderVideoChart(stocks(3), {
    width: 320, height: 240, fps: 10, seconds: 2
  });
  assert.ok(Buffer.isBuffer(mp4));
  assert.ok(mp4.length > 1000, 'mp4 too small');

  // mp4 box layout: <u32 size><4cc> — first box should be ftyp
  assert.equal(mp4.toString('ascii', 4, 8), 'ftyp');
  // an moov box must exist somewhere among top-level boxes
  const boxes = [];
  for (let p = 0; p + 8 <= mp4.length;) {
    const size = mp4.readUInt32BE(p);
    boxes.push(mp4.toString('ascii', p + 4, p + 8));
    if (size < 8) break;
    p += size;
  }
  assert.ok(boxes.includes('moov'), 'missing moov box');
  assert.ok(boxes.includes('mdat'), 'missing mdat box');
});
