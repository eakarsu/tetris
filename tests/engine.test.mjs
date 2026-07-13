import assert from "node:assert/strict";
import test from "node:test";

import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  PIECE_TYPES,
  canPlace,
  clearCompletedLines,
  createEmptyBoard,
  createGame,
  ghostY,
  hardDrop,
  holdPiece,
  lockPiece,
  movePiece,
  rotatePiece,
  seededRandom,
  softDrop,
  togglePause,
} from "../app/game/engine.ts";

test("a seed produces a deterministic state and a valid seven-piece bag", () => {
  const first = createGame(seededRandom(20260713), "playing");
  const second = createGame(seededRandom(20260713), "playing");
  assert.deepEqual(first, second);

  const firstBag = [first.active.type, ...first.queue, ...first.bag].slice(0, 7).sort();
  assert.deepEqual(firstBag, [...PIECE_TYPES].sort());
});

test("movement respects walls, the floor, and locked cells", () => {
  const state = createGame(seededRandom(1), "playing");
  const leftWall = { ...state, active: { type: "O", rotation: 0, x: -1, y: 5 } };
  assert.equal(canPlace(leftWall.board, leftWall.active), true);
  assert.strictEqual(movePiece(leftWall, -1), leftWall);

  const floor = { ...state, active: { type: "I", rotation: 0, x: 3, y: BOARD_HEIGHT - 2 } };
  assert.equal(canPlace(floor.board, floor.active, 0, 1), false);
  assert.strictEqual(softDrop(floor), floor);

  const occupied = createEmptyBoard();
  occupied[8][4] = "T";
  const blocked = { ...state, board: occupied, active: { type: "O", rotation: 0, x: 3, y: 7 } };
  assert.equal(canPlace(blocked.board, blocked.active), false);
});

test("rotation is atomic and uses kicks near boundaries", () => {
  const state = createGame(seededRandom(2), "playing");
  const nearWall = { ...state, active: { type: "T", rotation: 1, x: -1, y: 6 } };
  const rotated = rotatePiece(nearWall, -1);
  assert.notStrictEqual(rotated, nearWall);
  assert.equal(rotated.active.rotation, 0);
  assert.equal(canPlace(rotated.board, rotated.active), true);

  const blockedBoard = createEmptyBoard().map((row) => row.map(() => "J"));
  const pocket = blockedBoard.map((row) => [...row]);
  for (let y = 5; y < 9; y += 1) {
    for (let x = 3; x < 7; x += 1) pocket[y][x] = null;
  }
  const trapped = { ...state, board: pocket, active: { type: "T", rotation: 0, x: 3, y: 5 } };
  const attempt = rotatePiece(trapped, 1);
  if (attempt !== trapped) assert.equal(canPlace(attempt.board, attempt.active), true);
});

test("ghost position matches hard-drop lock position and awards drop points", () => {
  const state = createGame(seededRandom(3), "playing");
  const active = { type: "I", rotation: 0, x: 3, y: 0 };
  const prepared = { ...state, active };
  const landing = ghostY(prepared);
  const dropped = hardDrop(prepared, seededRandom(4));
  assert.equal(dropped.score, (landing - active.y) * 2);
  for (let x = 3; x <= 6; x += 1) assert.equal(dropped.board[landing + 1][x], "I");
});

test("hold can be used once per lock and a swap does not consume the queue", () => {
  const random = seededRandom(5);
  const initial = createGame(random, "playing");
  const originalType = initial.active.type;
  const nextType = initial.queue[0];
  const held = holdPiece(initial, random);
  assert.equal(held.hold, originalType);
  assert.equal(held.active.type, nextType);
  assert.equal(held.canHold, false);
  assert.strictEqual(holdPiece(held, random), held);

  const locked = hardDrop(held, random);
  assert.equal(locked.canHold, true);
  const queueBeforeSwap = [...locked.queue];
  const swapped = holdPiece(locked, random);
  assert.deepEqual(swapped.queue, queueBeforeSwap);
  assert.equal(swapped.canHold, false);
});

test("line clearing compacts all rows in one pass without shared arrays", () => {
  const board = createEmptyBoard();
  board[BOARD_HEIGHT - 1] = Array(BOARD_WIDTH).fill("Z");
  board[BOARD_HEIGHT - 2][0] = "J";
  const result = clearCompletedLines(board);
  assert.equal(result.cleared, 1);
  assert.equal(result.board[BOARD_HEIGHT - 1][0], "J");
  assert.ok(result.board[0].every((cell) => cell === null));
  result.board[0][0] = "I";
  assert.equal(result.board[1][0], null);
});

test("a single line scores correctly and advances line totals", () => {
  const state = createGame(seededRandom(8), "playing");
  const board = createEmptyBoard();
  board[BOARD_HEIGHT - 1] = Array(BOARD_WIDTH).fill("T");
  board[BOARD_HEIGHT - 1][4] = null;
  board[BOARD_HEIGHT - 1][5] = null;
  const prepared = {
    ...state,
    board,
    active: { type: "O", rotation: 0, x: 3, y: BOARD_HEIGHT - 2 },
  };
  const locked = lockPiece(prepared, seededRandom(9));
  assert.equal(locked.lines, 1);
  assert.equal(locked.score, 100);
  assert.equal(locked.level, 1);
  assert.equal(locked.lastClear, "SINGLE");
});

test("pause transitions are reversible and ignored outside an active run", () => {
  const ready = createGame(seededRandom(10), "ready");
  assert.strictEqual(togglePause(ready), ready);
  const playing = { ...ready, status: "playing" };
  const paused = togglePause(playing);
  assert.equal(paused.status, "paused");
  assert.equal(togglePause(paused).status, "playing");
});
