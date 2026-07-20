export const CONTROL_ACTIONS = [
  "moveLeft",
  "moveRight",
  "softDrop",
  "rotateClockwise",
  "rotateCounterClockwise",
  "hardDrop",
  "hold",
  "pause",
  "sound",
] as const;

export type ControlAction = (typeof CONTROL_ACTIONS)[number];
export type ControlBindings = Record<ControlAction, string>;

export const CONTROL_LABELS: Record<ControlAction, string> = {
  moveLeft: "Move left",
  moveRight: "Move right",
  softDrop: "Soft drop",
  rotateClockwise: "Rotate clockwise",
  rotateCounterClockwise: "Rotate counter-clockwise",
  hardDrop: "Hard drop",
  hold: "Hold piece",
  pause: "Pause or resume",
  sound: "Toggle sound",
};

export const DEFAULT_BINDINGS: ControlBindings = {
  moveLeft: "ArrowLeft",
  moveRight: "ArrowRight",
  softDrop: "ArrowDown",
  rotateClockwise: "ArrowUp",
  rotateCounterClockwise: "KeyZ",
  hardDrop: "Space",
  hold: "KeyC",
  pause: "KeyP",
  sound: "KeyM",
};

const BLOCKED_CODES = new Set(["Tab", "Escape", "Enter"]);

export function actionForCode(bindings: ControlBindings, code: string): ControlAction | null {
  return CONTROL_ACTIONS.find((action) => bindings[action] === code) ?? null;
}

export function rebindControl(bindings: ControlBindings, action: ControlAction, code: string) {
  if (!/^((Arrow(Left|Right|Up|Down))|Space|Key[A-Z]|Digit[0-9]|Numpad[0-9])$/.test(code) || BLOCKED_CODES.has(code)) {
    return { bindings, error: "Choose a letter, number, arrow, or Space key" };
  }
  const conflict = actionForCode(bindings, code);
  if (conflict && conflict !== action) {
    return { bindings, error: `${displayCode(code)} is already assigned to ${CONTROL_LABELS[conflict]}` };
  }
  return { bindings: { ...bindings, [action]: code }, error: null };
}

export function normalizeBindings(value: unknown): ControlBindings {
  if (!value || typeof value !== "object") return { ...DEFAULT_BINDINGS };
  let result = { ...DEFAULT_BINDINGS };
  for (const action of CONTROL_ACTIONS) {
    const code = (value as Record<string, unknown>)[action];
    if (typeof code !== "string") continue;
    const rebound = rebindControl(result, action, code);
    if (!rebound.error) result = rebound.bindings;
  }
  return result;
}

export function displayCode(code: string) {
  if (code === "Space") return "Space";
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return `Num ${code.slice(6)}`;
  return code.replace("Arrow", "");
}

export function clampVolume(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0.7;
  return Math.min(1, Math.max(0, parsed));
}
