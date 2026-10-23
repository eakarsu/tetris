import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTaskStore, filterRecords, formatAiSections, runWaveAi, toCsv, validateTaskInput } from '../runtime/wave3d.mjs';

test('wave3d tasks are owner-scoped and records filter/export', () => {
  const store = createTaskStore();
  const task = store.create('1', validateTaskInput({ title: 'Review sprint' }).value);
  store.create('2', validateTaskInput({ title: 'Other' }).value);
  assert.equal(store.list('1', {}).length, 1);
  assert.equal(store.update('2', task.id, { status: 'done' }), null);
  assert.equal(store.update('1', task.id, { status: 'done' }).status, 'done');
  const rows = [{ id: '1', feature: 'game-readiness', status: 'game-readiness', score: 0 }];
  assert.equal(filterRecords(rows, { q: 'game' }).length, 1);
  assert.match(toCsv(rows), /game-readiness/);
});

test('wave3d AI fallback is labelled and rendering preserves false/0/empty', async () => {
  const result = await runWaveAi('session-summary', { score: 0, lines: 0, pieces: 0 }, { env: {} });
  assert.equal(result.aiGenerated, false);
  assert.equal(result.score, 0);
  assert.equal(result.emptySession, true);
  const text = formatAiSections({ aiGenerated: false, score: 0, note: '' });
  assert.match(text, /Ai Generated: false/);
  assert.match(text, /Score: 0/);
  assert.match(text, /Note: Empty string/);
});

test('wave14b AI features drill-plan and score-analysis fall back deterministically; provider stub is honoured', async () => {
  const drill = await runWaveAi('drill-plan', { score: 0, lines: 0, pieces: 5, durationSeconds: 60 }, { env: {} });
  assert.equal(drill.aiGenerated, false);
  assert.match(drill.recommendation, /clearing single lines/);
  const score = await runWaveAi('score-analysis', { score: 0, lines: 0, pieces: 0 }, { env: {} });
  assert.equal(score.zeroScore, true);
  assert.equal(score.pointsPerPiece, 0);
  let seenUrl = '';
  const live = await runWaveAi('session-summary', { score: 10 }, { env: { OPENAI_API_KEY: 'test-key' }, fetchImpl: async (url) => { seenUrl = url; return { ok: true, json: async () => ({ choices: [{ message: { content: 'Coached summary' } }] }) }; } });
  assert.equal(seenUrl, 'https://api.openai.com/v1/chat/completions');
  assert.equal(live.aiGenerated, true);
  assert.equal(await runWaveAi('unknown-feature', {}, { env: {} }), null);
});
