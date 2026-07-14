import assert from "node:assert/strict";
import test from "node:test";

import { createRepeatController } from "../app/game/input-repeat.ts";

test("repeat controller owns DAS, ARR, duplicate suppression, and cleanup", () => {
  let delayCallback = null;
  let repeatCallback = null;
  const cleared = [];
  const scheduler = {
    setDelay(callback, milliseconds) {
      assert.equal(milliseconds, 165);
      delayCallback = callback;
      return "delay-handle";
    },
    clearDelay(handle) {
      cleared.push(handle);
    },
    setRepeating(callback, milliseconds) {
      assert.equal(milliseconds, 48);
      repeatCallback = callback;
      return "repeat-handle";
    },
    clearRepeating(handle) {
      cleared.push(handle);
    },
  };
  const controller = createRepeatController(scheduler);
  let actions = 0;

  assert.equal(controller.start("left", () => { actions += 1; }), true);
  assert.equal(actions, 1);
  assert.equal(controller.start("left", () => { actions += 1; }), false);
  assert.equal(actions, 1);
  assert.equal(controller.isActive("left"), true);

  delayCallback();
  repeatCallback();
  repeatCallback();
  assert.equal(actions, 3);

  controller.stop("left");
  assert.equal(controller.isActive("left"), false);
  assert.deepEqual(cleared, ["delay-handle", "repeat-handle"]);
});

test("stopAll releases independent simultaneous controls", () => {
  let handle = 0;
  const cleared = [];
  const scheduler = {
    setDelay() { handle += 1; return handle; },
    clearDelay(value) { cleared.push(value); },
    setRepeating() { handle += 1; return handle; },
    clearRepeating(value) { cleared.push(value); },
  };
  const controller = createRepeatController(scheduler);
  controller.start("left", () => {});
  controller.start("down", () => {});
  controller.stopAll();
  assert.equal(controller.isActive("left"), false);
  assert.equal(controller.isActive("down"), false);
  assert.deepEqual(cleared.sort(), [1, 2]);
});
