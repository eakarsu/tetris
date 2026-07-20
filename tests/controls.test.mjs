import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_BINDINGS,
  actionForCode,
  clampVolume,
  displayCode,
  normalizeBindings,
  rebindControl,
} from "../app/game/controls.ts";

test("control bindings resolve, rebind, reject collisions, and recover corrupt storage", () => {
  assert.equal(actionForCode(DEFAULT_BINDINGS, "ArrowLeft"), "moveLeft");
  const rebound = rebindControl(DEFAULT_BINDINGS, "rotateClockwise", "KeyQ");
  assert.equal(rebound.error, null);
  assert.equal(actionForCode(rebound.bindings, "KeyQ"), "rotateClockwise");

  const conflict = rebindControl(rebound.bindings, "hold", "KeyQ");
  assert.match(conflict.error, /already assigned/i);
  assert.strictEqual(conflict.bindings, rebound.bindings);

  assert.deepEqual(normalizeBindings({ moveLeft: "invalid", hardDrop: "KeyH" }), {
    ...DEFAULT_BINDINGS,
    hardDrop: "KeyH",
  });
  assert.equal(displayCode("ArrowDown"), "Down");
  assert.equal(displayCode("KeyM"), "M");
});

test("volume settings are finite and capped", () => {
  assert.equal(clampVolume(-1), 0);
  assert.equal(clampVolume(2), 1);
  assert.equal(clampVolume("0.35"), 0.35);
  assert.equal(clampVolume("not-a-number"), 0.7);
});
