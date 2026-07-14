import assert from "node:assert/strict";
import test from "node:test";

import {
  countdownDelay,
  formatPiecesPerSecond,
  formatRunTime,
  nextCountdownStep,
  piecesPerSecond,
} from "../app/game/session.ts";

test("run time formatting handles minute and hour boundaries", () => {
  assert.equal(formatRunTime(-1), "0:00");
  assert.equal(formatRunTime(59_999), "0:59");
  assert.equal(formatRunTime(60_000), "1:00");
  assert.equal(formatRunTime(3_599_999), "59:59");
  assert.equal(formatRunTime(3_600_000), "1:00:00");
});

test("piece rate remains finite before a run starts and formats consistently", () => {
  assert.equal(piecesPerSecond(0, 0), 0);
  assert.equal(piecesPerSecond(10, 0), 0);
  assert.equal(piecesPerSecond(12, 6_000), 2);
  assert.equal(formatPiecesPerSecond(7, 4_000), "1.75");
});

test("countdown uses true one-second beats and a short GO hold", () => {
  const sequence = [3];
  let step = 3;
  while (true) {
    const next = nextCountdownStep(step);
    if (next === null) break;
    sequence.push(next);
    step = next;
  }
  assert.deepEqual(sequence, [3, 2, 1, 0]);
  assert.equal(countdownDelay(3), 1000);
  assert.equal(countdownDelay(1), 1000);
  assert.equal(countdownDelay(0), 500);
});
