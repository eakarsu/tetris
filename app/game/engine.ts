export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 22;
export const HIDDEN_ROWS = 2;
export const VISIBLE_ROWS = BOARD_HEIGHT - HIDDEN_ROWS;

export const PIECE_TYPES = ["I", "J", "L", "O", "S", "T", "Z"] as const;

export type Tetromino = (typeof PIECE_TYPES)[number];
export type Rotation = 0 | 1 | 2 | 3;
export type Board = Array<Array<Tetromino | null>>;
export type GameStatus = "ready" | "playing" | "paused" | "over";

export type ActivePiece = {
  type: Tetromino;
  rotation: Rotation;
  x: number;
  y: number;
};

export type GameState = {
  board: Board;
  active: ActivePiece | null;
  queue: Tetromino[];
  bag: Tetromino[];
  hold: Tetromino | null;
  canHold: boolean;
  score: number;
  lines: number;
  level: number;
  combo: number;
  backToBack: boolean;
  status: GameStatus;
  lastClear: string | null;
  clearSerial: number;
};

type Point = readonly [number, number];

const PIECE_CELLS: Record<Tetromino, ReadonlyArray<ReadonlyArray<Point>>> = {
  I: [
    [[0, 1], [1, 1], [2, 1], [3, 1]],
    [[2, 0], [2, 1], [2, 2], [2, 3]],
    [[0, 2], [1, 2], [2, 2], [3, 2]],
    [[1, 0], [1, 1], [1, 2], [1, 3]],
  ],
  J: [
    [[0, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [2, 2]],
    [[1, 0], [1, 1], [0, 2], [1, 2]],
  ],
  L: [
    [[2, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [1, 2], [2, 2]],
    [[0, 1], [1, 1], [2, 1], [0, 2]],
    [[0, 0], [1, 0], [1, 1], [1, 2]],
  ],
  O: [
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
  ],
  S: [
    [[1, 0], [2, 0], [0, 1], [1, 1]],
    [[1, 0], [1, 1], [2, 1], [2, 2]],
    [[1, 1], [2, 1], [0, 2], [1, 2]],
    [[0, 0], [0, 1], [1, 1], [1, 2]],
  ],
  T: [
    [[1, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [1, 2]],
    [[1, 0], [0, 1], [1, 1], [1, 2]],
  ],
  Z: [
    [[0, 0], [1, 0], [1, 1], [2, 1]],
    [[2, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [1, 2], [2, 2]],
    [[1, 0], [0, 1], [1, 1], [0, 2]],
  ],
};

const JLSTZ_KICKS: Record<string, ReadonlyArray<Point>> = {
  "0>1": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  "1>0": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  "1>2": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  "2>1": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  "2>3": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  "3>2": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  "3>0": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  "0>3": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
};

const I_KICKS: Record<string, ReadonlyArray<Point>> = {
  "0>1": [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  "1>0": [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  "1>2": [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
  "2>1": [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  "2>3": [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  "3>2": [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  "3>0": [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  "0>3": [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
};

export function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_HEIGHT }, () =>
    Array<Tetromino | null>(BOARD_WIDTH).fill(null),
  );
}

export function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffledBag(random: () => number): Tetromino[] {
  const bag = [...PIECE_TYPES];
  for (let index = bag.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [bag[index], bag[swapIndex]] = [bag[swapIndex], bag[index]];
  }
  return bag;
}

function fillQueue(
  queue: Tetromino[],
  bag: Tetromino[],
  random: () => number,
  minimum = 6,
): { queue: Tetromino[]; bag: Tetromino[] } {
  const nextQueue = [...queue];
  let nextBag = [...bag];
  while (nextQueue.length < minimum) {
    if (nextBag.length === 0) nextBag = shuffledBag(random);
    nextQueue.push(nextBag.shift() as Tetromino);
  }
  return { queue: nextQueue, bag: nextBag };
}

export function spawnPiece(type: Tetromino): ActivePiece {
  return { type, rotation: 0, x: 3, y: 0 };
}

function drawNext(
  queue: Tetromino[],
  bag: Tetromino[],
  random: () => number,
): { active: ActivePiece; queue: Tetromino[]; bag: Tetromino[] } {
  const filled = fillQueue(queue, bag, random);
  const nextQueue = [...filled.queue];
  const type = nextQueue.shift() as Tetromino;
  const replenished = fillQueue(nextQueue, filled.bag, random, 5);
  return {
    active: spawnPiece(type),
    queue: replenished.queue,
    bag: replenished.bag,
  };
}

export function createGame(
  random: () => number = Math.random,
  status: GameStatus = "ready",
): GameState {
  const drawn = drawNext([], [], random);
  return {
    board: createEmptyBoard(),
    active: drawn.active,
    queue: drawn.queue,
    bag: drawn.bag,
    hold: null,
    canHold: true,
    score: 0,
    lines: 0,
    level: 1,
    combo: -1,
    backToBack: false,
    status,
    lastClear: null,
    clearSerial: 0,
  };
}

export function startGame(random: () => number = Math.random): GameState {
  return createGame(random, "playing");
}

export function getPieceCells(piece: ActivePiece): Point[] {
  return PIECE_CELLS[piece.type][piece.rotation].map(([x, y]) => [
    piece.x + x,
    piece.y + y,
  ] as const);
}

export function getPreviewCells(type: Tetromino): Point[] {
  return PIECE_CELLS[type][0].map(([x, y]) => [x, y] as const);
}

export function canPlace(
  board: Board,
  piece: ActivePiece,
  offsetX = 0,
  offsetY = 0,
  rotation: Rotation = piece.rotation,
): boolean {
  return PIECE_CELLS[piece.type][rotation].every(([cellX, cellY]) => {
    const x = piece.x + cellX + offsetX;
    const y = piece.y + cellY + offsetY;
    if (x < 0 || x >= BOARD_WIDTH || y >= BOARD_HEIGHT) return false;
    return y < 0 || board[y][x] === null;
  });
}

export function movePiece(state: GameState, offsetX: number): GameState {
  if (state.status !== "playing" || !state.active) return state;
  if (!canPlace(state.board, state.active, offsetX, 0)) return state;
  return {
    ...state,
    active: { ...state.active, x: state.active.x + offsetX },
    lastClear: null,
  };
}

export function softDrop(state: GameState): GameState {
  if (state.status !== "playing" || !state.active) return state;
  if (!canPlace(state.board, state.active, 0, 1)) return state;
  return {
    ...state,
    active: { ...state.active, y: state.active.y + 1 },
    score: state.score + 1,
    lastClear: null,
  };
}

export function gravityStep(state: GameState): GameState {
  if (state.status !== "playing" || !state.active) return state;
  if (!canPlace(state.board, state.active, 0, 1)) return state;
  return {
    ...state,
    active: { ...state.active, y: state.active.y + 1 },
    lastClear: null,
  };
}

export function rotatePiece(state: GameState, direction: 1 | -1): GameState {
  if (state.status !== "playing" || !state.active) return state;
  const from = state.active.rotation;
  const to = ((from + direction + 4) % 4) as Rotation;
  const key = `${from}>${to}`;
  const kicks = state.active.type === "O"
    ? ([[0, 0]] as ReadonlyArray<Point>)
    : state.active.type === "I"
      ? I_KICKS[key]
      : JLSTZ_KICKS[key];

  for (const [offsetX, offsetY] of kicks ?? [[0, 0]]) {
    if (canPlace(state.board, state.active, offsetX, offsetY, to)) {
      return {
        ...state,
        active: {
          ...state.active,
          rotation: to,
          x: state.active.x + offsetX,
          y: state.active.y + offsetY,
        },
        lastClear: null,
      };
    }
  }
  return state;
}

export function ghostY(state: GameState): number {
  if (!state.active) return 0;
  let y = state.active.y;
  while (canPlace(state.board, { ...state.active, y }, 0, 1)) y += 1;
  return y;
}

function mergeActive(board: Board, active: ActivePiece): { board: Board; toppedOut: boolean } {
  const merged = board.map((row) => [...row]);
  let toppedOut = false;
  for (const [x, y] of getPieceCells(active)) {
    if (y < HIDDEN_ROWS) toppedOut = true;
    if (y >= 0 && y < BOARD_HEIGHT && x >= 0 && x < BOARD_WIDTH) {
      merged[y][x] = active.type;
    }
  }
  return { board: merged, toppedOut };
}

export function clearCompletedLines(board: Board): { board: Board; cleared: number } {
  const survivors = board.filter((row) => row.some((cell) => cell === null));
  const cleared = BOARD_HEIGHT - survivors.length;
  const emptyRows = Array.from({ length: cleared }, () =>
    Array<Tetromino | null>(BOARD_WIDTH).fill(null),
  );
  return { board: [...emptyRows, ...survivors.map((row) => [...row])], cleared };
}

function lineClearLabel(cleared: number, backToBack: boolean, combo: number): string | null {
  if (cleared === 0) return null;
  const names = ["", "SINGLE", "DOUBLE", "TRIPLE", "TETRIS"];
  const parts = [names[cleared]];
  if (cleared === 4 && backToBack) parts.unshift("BACK-TO-BACK");
  if (combo > 0) parts.push(`${combo + 1}× COMBO`);
  return parts.join(" · ");
}

function spawnFollowing(state: GameState, random: () => number): GameState {
  const drawn = drawNext(state.queue, state.bag, random);
  const blocked = !canPlace(state.board, drawn.active);
  return {
    ...state,
    active: blocked ? null : drawn.active,
    queue: drawn.queue,
    bag: drawn.bag,
    canHold: true,
    status: blocked ? "over" : state.status,
  };
}

export function lockPiece(
  state: GameState,
  random: () => number = Math.random,
): GameState {
  if (state.status !== "playing" || !state.active) return state;
  const merged = mergeActive(state.board, state.active);
  const result = clearCompletedLines(merged.board);
  const combo = result.cleared > 0 ? state.combo + 1 : -1;
  const wasBackToBack = result.cleared === 4 && state.backToBack;
  const baseScores = [0, 100, 300, 500, 800];
  let clearScore = baseScores[result.cleared] * state.level;
  if (wasBackToBack) clearScore = Math.round(clearScore * 1.5);
  const comboScore = result.cleared > 0 ? Math.max(0, combo) * 50 * state.level : 0;
  const lines = state.lines + result.cleared;
  const level = Math.floor(lines / 10) + 1;
  const backToBack = result.cleared === 4
    ? true
    : result.cleared > 0
      ? false
      : state.backToBack;

  const settled: GameState = {
    ...state,
    board: result.board,
    active: null,
    score: state.score + clearScore + comboScore,
    lines,
    level,
    combo,
    backToBack,
    lastClear: lineClearLabel(result.cleared, wasBackToBack, combo),
    clearSerial: result.cleared > 0 ? state.clearSerial + 1 : state.clearSerial,
    status: merged.toppedOut ? "over" : state.status,
  };

  return merged.toppedOut ? settled : spawnFollowing(settled, random);
}

export function hardDrop(
  state: GameState,
  random: () => number = Math.random,
): GameState {
  if (state.status !== "playing" || !state.active) return state;
  const landingY = ghostY(state);
  const distance = landingY - state.active.y;
  return lockPiece({
    ...state,
    active: { ...state.active, y: landingY },
    score: state.score + distance * 2,
  }, random);
}

export function holdPiece(
  state: GameState,
  random: () => number = Math.random,
): GameState {
  if (state.status !== "playing" || !state.active || !state.canHold) return state;
  const currentType = state.active.type;

  if (state.hold === null) {
    const next = spawnFollowing({ ...state, active: null, hold: currentType }, random);
    return { ...next, canHold: false };
  }

  const active = spawnPiece(state.hold);
  const blocked = !canPlace(state.board, active);
  return {
    ...state,
    active: blocked ? null : active,
    hold: currentType,
    canHold: false,
    status: blocked ? "over" : state.status,
    lastClear: null,
  };
}

export function togglePause(state: GameState): GameState {
  if (state.status === "playing") return { ...state, status: "paused" };
  if (state.status === "paused") return { ...state, status: "playing" };
  return state;
}

export function gravityInterval(level: number): number {
  return Math.max(72, Math.round(1000 * 0.82 ** Math.max(0, level - 1)));
}

export function formatScore(score: number): string {
  return Math.max(0, score).toLocaleString("en-US").padStart(6, "0");
}
