import assert from "node:assert/strict";
import test from "node:test";

import { resumeAudioContext } from "../app/game/audio.ts";

test("mobile audio waits for a suspended context to become running", async () => {
  const events = [];
  const context = {
    state: "suspended",
    async resume() {
      events.push("resume");
      await Promise.resolve();
      this.state = "running";
    },
  };

  assert.equal(await resumeAudioContext(context), true);
  assert.equal(context.state, "running");
  assert.deepEqual(events, ["resume"]);
});

test("mobile audio handles running, closed, and rejected contexts safely", async () => {
  let resumeCalls = 0;
  assert.equal(await resumeAudioContext({
    state: "running",
    async resume() { resumeCalls += 1; },
  }), true);
  assert.equal(await resumeAudioContext({
    state: "closed",
    async resume() { resumeCalls += 1; },
  }), false);
  assert.equal(resumeCalls, 0);

  assert.equal(await resumeAudioContext({
    state: "suspended",
    async resume() { throw new Error("blocked"); },
  }), false);
});

test("a trusted retry is not blocked by an older pending resume", async () => {
  let resumeCalls = 0;
  let finishFirstResume = () => {};
  const context = {
    state: "suspended",
    resume() {
      resumeCalls += 1;
      if (resumeCalls === 1) {
        return new Promise((resolve) => { finishFirstResume = resolve; });
      }
      this.state = "running";
      return Promise.resolve();
    },
  };

  const firstAttempt = resumeAudioContext(context);
  assert.equal(await resumeAudioContext(context), true);
  assert.equal(resumeCalls, 2);
  finishFirstResume();
  assert.equal(await firstAttempt, true);
});
