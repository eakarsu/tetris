"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  BOARD_WIDTH,
  HIDDEN_ROWS,
  VISIBLE_ROWS,
  canPlace,
  createGame,
  formatScore,
  getPieceCells,
  getPreviewCells,
  ghostY,
  gravityInterval,
  gravityStep,
  hardDrop,
  holdPiece,
  lockPiece,
  movePiece,
  rotatePiece,
  seededRandom,
  softDrop,
  togglePause,
  type GameState,
  type Tetromino,
} from "./game/engine";
import { createRepeatController } from "./game/input-repeat";
import {
  countdownDelay,
  formatPiecesPerSecond,
  formatRunTime,
  nextCountdownStep,
} from "./game/session";

const STORAGE_KEY = "blockline:tetris:v1";
const LOCK_DELAY = 500;
const MAX_LOCK_RESETS = 15;

type SoundName = "move" | "rotate" | "drop" | "clear" | "level" | "over";
type CellView = { type: Tetromino | null; mode: "empty" | "locked" | "ghost" | "active" };
type Callout = { id: number; text: string };

function MiniPiece({ type, compact = false }: { type: Tetromino | null; compact?: boolean }) {
  const occupied = new Set(
    type ? getPreviewCells(type).map(([x, y]) => `${x}:${y}`) : [],
  );
  return (
    <div className={`mini-piece${compact ? " mini-piece--compact" : ""}`} aria-hidden="true">
      {Array.from({ length: 12 }, (_, index) => {
        const x = index % 4;
        const y = Math.floor(index / 4);
        const filled = occupied.has(`${x}:${y}`);
        return (
          <span
            className={`mini-cell${filled && type ? ` piece-${type}` : ""}`}
            key={index}
          />
        );
      })}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Keycap({ children }: { children: React.ReactNode }) {
  return <kbd>{children}</kbd>;
}

type RepeatButtonProps = {
  label: string;
  symbol: string;
  onStart: () => void;
  onStop: () => void;
  disabled?: boolean;
  className?: string;
};

function RepeatButton({ label, symbol, onStart, onStop, disabled = false, className = "" }: RepeatButtonProps) {
  const keyboardActivatedRef = useRef(false);
  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    onStart();
  };
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if ((event.key === "Enter" || event.key === " ") && !event.repeat) {
      event.preventDefault();
      keyboardActivatedRef.current = true;
      onStart();
    }
  };
  const handleKeyUp = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === " ") onStop();
  };
  return (
    <button
      type="button"
      className={`touch-button ${className}`}
      aria-label={label}
      disabled={disabled}
      onPointerDown={handlePointerDown}
      onPointerUp={onStop}
      onPointerCancel={onStop}
      onLostPointerCapture={onStop}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onBlur={() => {
        keyboardActivatedRef.current = false;
        onStop();
      }}
      onClick={(event) => {
        if (event.detail === 0) {
          if (keyboardActivatedRef.current) {
            keyboardActivatedRef.current = false;
            return;
          }
          onStart();
          onStop();
        }
      }}
    >
      <span aria-hidden="true">{symbol}</span>
      <small>{label}</small>
    </button>
  );
}

type ActionButtonProps = {
  label: string;
  symbol: string;
  onAction: () => void;
  disabled?: boolean;
  className?: string;
};

function ActionButton({ label, symbol, onAction, disabled = false, className = "" }: ActionButtonProps) {
  return (
    <button
      type="button"
      className={`touch-button ${className}`}
      aria-label={label}
      disabled={disabled}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        onAction();
      }}
      onClick={(event) => {
        if (event.detail === 0) onAction();
      }}
    >
      <span aria-hidden="true">{symbol}</span>
      <small>{label}</small>
    </button>
  );
}

export default function Home() {
  const [game, setGame] = useState<GameState>(() => createGame(seededRandom(0x7e7a15)));
  const [bestScore, setBestScore] = useState(0);
  const [soundOn, setSoundOn] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("Game ready");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [callout, setCallout] = useState<Callout | null>(null);

  const gameRef = useRef(game);
  const randomRef = useRef<() => number>(seededRandom(0x7e7a15));
  const audioRef = useRef<AudioContext | null>(null);
  const gravityElapsedRef = useRef(0);
  const lockElapsedRef = useRef(0);
  const lockResetsRef = useRef(0);
  const elapsedMsRef = useRef(0);
  const clockPaintRef = useRef(0);
  const countdownRef = useRef<number | null>(null);
  const repeatControllerRef = useRef<ReturnType<typeof createRepeatController> | null>(null);
  if (repeatControllerRef.current === null) repeatControllerRef.current = createRepeatController();
  const heldKeysRef = useRef(new Set<string>());
  const calloutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const calloutSerialRef = useRef(0);
  const helpPausedGameRef = useRef(false);
  const helpHiddenWhileOpenRef = useRef(false);
  const helpDialogRef = useRef<HTMLElement | null>(null);
  const helpCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const helpOpenerRef = useRef<HTMLElement | null>(null);
  const storageReadyRef = useRef(false);
  const previousEventRef = useRef({
    clearSerial: game.clearSerial,
    level: game.level,
    status: game.status,
  });

  const paintClock = useCallback(() => {
    setElapsedMs(Math.floor(elapsedMsRef.current));
  }, []);

  const replaceGame = useCallback((next: GameState) => {
    gameRef.current = next;
    setGame(next);
    setBestScore((current) => Math.max(current, next.score));
    if (next.status === "over") paintClock();
  }, [paintClock]);

  const playSound = useCallback((name: SoundName) => {
    if (!soundOn || typeof window === "undefined") return;
    const AudioContextClass = window.AudioContext;
    if (!AudioContextClass) return;
    const context = audioRef.current ?? new AudioContextClass();
    audioRef.current = context;
    if (context.state === "suspended") void context.resume();

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const settings: Record<SoundName, [number, number, OscillatorType]> = {
      move: [150, 0.028, "square"],
      rotate: [260, 0.045, "triangle"],
      drop: [92, 0.085, "square"],
      clear: [520, 0.16, "sine"],
      level: [720, 0.2, "triangle"],
      over: [110, 0.28, "sawtooth"],
    };
    const [frequency, duration, type] = settings[name];
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    if (name === "clear" || name === "level") {
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.7, context.currentTime + duration);
    }
    if (name === "over") {
      oscillator.frequency.exponentialRampToValueAtTime(55, context.currentTime + duration);
    }
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.055, context.currentTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration + 0.02);
  }, [soundOn]);

  const resetTiming = useCallback(() => {
    gravityElapsedRef.current = 0;
    lockElapsedRef.current = 0;
    lockResetsRef.current = 0;
  }, []);

  const stopRepeat = useCallback((key?: string) => {
    if (key) repeatControllerRef.current?.stop(key);
    else repeatControllerRef.current?.stopAll();
  }, []);

  const beginRepeat = useCallback((key: string, action: () => void) => {
    repeatControllerRef.current?.start(key, action);
  }, []);

  const releaseHeldControls = useCallback(() => {
    heldKeysRef.current.clear();
    stopRepeat();
  }, [stopRepeat]);

  const clearCallout = useCallback(() => {
    if (calloutTimerRef.current) clearTimeout(calloutTimerRef.current);
    calloutTimerRef.current = null;
    setCallout(null);
  }, []);

  const showCallout = useCallback((text: string) => {
    if (calloutTimerRef.current) clearTimeout(calloutTimerRef.current);
    calloutSerialRef.current += 1;
    setCallout({ id: calloutSerialRef.current, text });
    calloutTimerRef.current = setTimeout(() => {
      setCallout(null);
      calloutTimerRef.current = null;
    }, 950);
  }, []);

  const cancelCountdown = useCallback(() => {
    countdownRef.current = null;
    setCountdown(null);
    setAnnouncement("Start cancelled. Game ready");
  }, []);

  const beginGame = useCallback(() => {
    if (countdownRef.current !== null) return;
    const seed = (Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0;
    randomRef.current = seededRandom(seed);
    releaseHeldControls();
    resetTiming();
    elapsedMsRef.current = 0;
    clockPaintRef.current = 0;
    setElapsedMs(0);
    clearCallout();
    replaceGame(createGame(randomRef.current, "ready"));
    countdownRef.current = 3;
    setCountdown(3);
    setAnnouncement("Starting in 3");
  }, [clearCallout, releaseHeldControls, replaceGame, resetTiming]);

  const manipulate = useCallback((transform: (current: GameState) => GameState, sound: SoundName) => {
    const current = gameRef.current;
    if (current.status !== "playing" || !current.active) return;
    const grounded = !canPlace(current.board, current.active, 0, 1);
    const next = transform(current);
    if (next === current) return;
    if (grounded && lockResetsRef.current < MAX_LOCK_RESETS) {
      lockElapsedRef.current = 0;
      lockResetsRef.current += 1;
    }
    replaceGame(next);
    playSound(sound);
  }, [playSound, replaceGame]);

  const moveLeft = useCallback(() => manipulate((current) => movePiece(current, -1), "move"), [manipulate]);
  const moveRight = useCallback(() => manipulate((current) => movePiece(current, 1), "move"), [manipulate]);
  const moveDown = useCallback(() => manipulate(softDrop, "move"), [manipulate]);
  const rotateClockwise = useCallback(() => manipulate((current) => rotatePiece(current, 1), "rotate"), [manipulate]);
  const rotateCounterClockwise = useCallback(() => manipulate((current) => rotatePiece(current, -1), "rotate"), [manipulate]);

  const dropNow = useCallback(() => {
    const current = gameRef.current;
    const next = hardDrop(current, randomRef.current);
    if (next === current) return;
    resetTiming();
    replaceGame(next);
    playSound("drop");
  }, [playSound, replaceGame, resetTiming]);

  const holdNow = useCallback(() => {
    const current = gameRef.current;
    const next = holdPiece(current, randomRef.current);
    if (next === current) return;
    resetTiming();
    replaceGame(next);
    playSound("rotate");
  }, [playSound, replaceGame, resetTiming]);

  const pauseNow = useCallback(() => {
    const current = gameRef.current;
    const next = togglePause(current);
    if (next === current) return;
    releaseHeldControls();
    if (next.status === "paused") paintClock();
    replaceGame(next);
    setAnnouncement(next.status === "paused" ? "Game paused" : "Game resumed");
  }, [paintClock, releaseHeldControls, replaceGame]);

  const openHelp = useCallback(() => {
    helpOpenerRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    releaseHeldControls();
    if (countdownRef.current !== null) cancelCountdown();
    const current = gameRef.current;
    helpPausedGameRef.current = current.status === "playing";
    helpHiddenWhileOpenRef.current = false;
    if (current.status === "playing") {
      paintClock();
      replaceGame(togglePause(current));
    }
    setHelpOpen(true);
  }, [cancelCountdown, paintClock, releaseHeldControls, replaceGame]);

  const closeHelp = useCallback(() => {
    const opener = helpOpenerRef.current;
    setHelpOpen(false);
    const shouldResume = helpPausedGameRef.current
      && !helpHiddenWhileOpenRef.current
      && gameRef.current.status === "paused";
    helpPausedGameRef.current = false;
    helpHiddenWhileOpenRef.current = false;
    if (shouldResume) {
      replaceGame(togglePause(gameRef.current));
      setAnnouncement("Game resumed");
    }
    helpOpenerRef.current = null;
    window.requestAnimationFrame(() => opener?.focus());
  }, [replaceGame]);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  useEffect(() => {
    if (!helpOpen) return;
    const frame = window.requestAnimationFrame(() => helpCloseButtonRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [helpOpen]);

  useEffect(() => {
    const loadPreferences = window.setTimeout(() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const stored = JSON.parse(raw) as { version?: number; best?: number; sound?: boolean };
          if (stored.version === 1 && Number.isSafeInteger(stored.best) && (stored.best ?? 0) >= 0) {
            setBestScore(Math.min(stored.best ?? 0, 999_999_999));
          }
          if (stored.version === 1 && typeof stored.sound === "boolean") setSoundOn(stored.sound);
        }
      } catch {
        // Local preferences are optional; gameplay remains fully available.
      }
      storageReadyRef.current = true;
    }, 0);
    return () => window.clearTimeout(loadPreferences);
  }, []);

  useEffect(() => {
    if (!storageReadyRef.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, best: bestScore, sound: soundOn }));
    } catch {
      // Storage may be disabled or full; no gameplay behavior depends on it.
    }
  }, [bestScore, soundOn]);

  useEffect(() => {
    countdownRef.current = countdown;
    if (countdown === null) return;

    const timer = window.setTimeout(() => {
      const nextCount = nextCountdownStep(countdown);
      if (nextCount !== null) {
        setAnnouncement(nextCount === 0 ? "Go" : `Starting in ${nextCount}`);
        setCountdown(nextCount);
        return;
      }
      countdownRef.current = null;
      setCountdown(null);
      if (gameRef.current.status === "ready") {
        replaceGame({ ...gameRef.current, status: "playing" });
        setAnnouncement("Game started");
      }
    }, countdownDelay(countdown));

    return () => window.clearTimeout(timer);
  }, [countdown, replaceGame]);

  useEffect(() => {
    const previous = previousEventRef.current;
    let eventMessage: string | null = null;
    if (game.clearSerial > previous.clearSerial) {
      eventMessage = game.lastClear ?? "LINES CLEARED";
      setAnnouncement(eventMessage);
      playSound("clear");
    }
    if (game.level > previous.level) {
      eventMessage = eventMessage
        ? `${eventMessage} · LEVEL ${game.level}`
        : `LEVEL ${game.level}`;
      setAnnouncement(`Level ${game.level}`);
      playSound("level");
    }
    if (eventMessage) showCallout(eventMessage);
    if (game.status === "over" && previous.status !== "over") {
      releaseHeldControls();
      setAnnouncement(`Game over. Score ${game.score.toLocaleString("en-US")}`);
      playSound("over");
    }
    previousEventRef.current = {
      clearSerial: game.clearSerial,
      level: game.level,
      status: game.status,
    };
  }, [
    game.clearSerial,
    game.lastClear,
    game.level,
    game.score,
    game.status,
    playSound,
    releaseHeldControls,
    showCallout,
  ]);

  useEffect(() => {
    if (game.status !== "playing") return;
    let animationFrame = 0;
    let previousTime: number | null = null;

    const advance = (time: number) => {
      const current = gameRef.current;
      const rawDelta = previousTime === null ? 0 : Math.max(0, time - previousTime);
      const delta = Math.min(50, rawDelta);
      previousTime = time;

      if (current.status === "playing" && current.active) {
        elapsedMsRef.current += rawDelta;
        if (time - clockPaintRef.current >= 250) {
          clockPaintRef.current = time;
          setElapsedMs(Math.floor(elapsedMsRef.current));
        }
        const grounded = !canPlace(current.board, current.active, 0, 1);
        if (grounded) {
          gravityElapsedRef.current = 0;
          lockElapsedRef.current += delta;
          if (lockElapsedRef.current >= LOCK_DELAY) {
            const locked = lockPiece(current, randomRef.current);
            resetTiming();
            replaceGame(locked);
          }
        } else {
          lockElapsedRef.current = 0;
          gravityElapsedRef.current += delta;
          const interval = gravityInterval(current.level);
          if (gravityElapsedRef.current >= interval) {
            gravityElapsedRef.current -= interval;
            replaceGame(gravityStep(current));
          }
        }
      }
      animationFrame = requestAnimationFrame(advance);
    };

    animationFrame = requestAnimationFrame(advance);
    return () => cancelAnimationFrame(animationFrame);
  }, [game.status, replaceGame, resetTiming]);

  useEffect(() => {
    const isInteractiveTarget = (target: EventTarget | null) => {
      const element = target as HTMLElement | null;
      return element?.matches("button, input, textarea, select, a, [contenteditable='true']") ?? false;
    };

    const controlCodes = new Set([
      "ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", "Space", "KeyX", "KeyZ",
      "KeyC", "ShiftLeft", "ShiftRight",
    ]);
    const oneShotCodes = new Set([
      "Space", "ArrowUp", "KeyX", "KeyZ", "KeyC", "ShiftLeft", "ShiftRight",
      "KeyP", "Escape", "Enter", "KeyR", "KeyM",
    ]);
    const repeatCodes = new Set(["ArrowLeft", "ArrowRight", "ArrowDown"]);

    const startHorizontal = (code: "ArrowLeft" | "ArrowRight") => {
      if (heldKeysRef.current.has(code)) return;
      heldKeysRef.current.add(code);
      if (code === "ArrowLeft") {
        stopRepeat("key-right");
        beginRepeat("key-left", moveLeft);
      } else {
        stopRepeat("key-left");
        beginRepeat("key-right", moveRight);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (helpOpen) {
        if (event.code === "Tab") {
          const dialog = helpDialogRef.current;
          const focusable = dialog
            ? [...dialog.querySelectorAll<HTMLElement>(
              "button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
            )]
            : [];
          if (focusable.length > 0) {
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && (document.activeElement === first || !dialog?.contains(document.activeElement))) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          }
          return;
        }
        if (event.code === "Escape" && !event.repeat) {
          event.preventDefault();
          closeHelp();
        }
        return;
      }
      if (isInteractiveTarget(event.target)) return;
      if (controlCodes.has(event.code)) event.preventDefault();
      if (event.repeat && (oneShotCodes.has(event.code) || repeatCodes.has(event.code))) return;

      if (event.code === "KeyM") {
        setSoundOn((value) => !value);
        return;
      }
      if (event.code === "Enter" && (gameRef.current.status === "ready" || gameRef.current.status === "over")) {
        event.preventDefault();
        beginGame();
        return;
      }
      if (event.code === "KeyR" && gameRef.current.status === "over") {
        event.preventDefault();
        beginGame();
        return;
      }
      if (event.code === "KeyP" || event.code === "Escape") {
        if (gameRef.current.status === "playing" || gameRef.current.status === "paused") {
          event.preventDefault();
          pauseNow();
        }
        return;
      }
      if (gameRef.current.status !== "playing") return;

      if (event.code === "ArrowLeft") startHorizontal("ArrowLeft");
      else if (event.code === "ArrowRight") startHorizontal("ArrowRight");
      else if (event.code === "ArrowDown") {
        if (!heldKeysRef.current.has(event.code)) {
          heldKeysRef.current.add(event.code);
          beginRepeat("key-down", moveDown);
        }
      }
      else if (event.code === "ArrowUp" || event.code === "KeyX") rotateClockwise();
      else if (event.code === "KeyZ") rotateCounterClockwise();
      else if (event.code === "Space") dropNow();
      else if (event.code === "KeyC" || event.code === "ShiftLeft" || event.code === "ShiftRight") holdNow();
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (!repeatCodes.has(event.code)) return;
      heldKeysRef.current.delete(event.code);
      if (event.code === "ArrowDown") {
        stopRepeat("key-down");
        return;
      }

      const releasedLeft = event.code === "ArrowLeft";
      stopRepeat(releasedLeft ? "key-left" : "key-right");
      const opposite = releasedLeft ? "ArrowRight" : "ArrowLeft";
      if (gameRef.current.status === "playing" && heldKeysRef.current.has(opposite)) {
        if (opposite === "ArrowLeft") beginRepeat("key-left", moveLeft);
        else beginRepeat("key-right", moveRight);
      }
    };

    const autoPause = () => {
      if (gameRef.current.status === "playing") {
        releaseHeldControls();
        paintClock();
        replaceGame(togglePause(gameRef.current));
        setAnnouncement("Game paused");
      }
    };
    const onVisibility = () => {
      if (document.visibilityState !== "hidden") return;
      if (helpOpen) helpHiddenWhileOpenRef.current = true;
      if (countdownRef.current !== null) cancelCountdown();
      releaseHeldControls();
      autoPause();
    };

    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", releaseHeldControls);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      releaseHeldControls();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", releaseHeldControls);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [
    beginRepeat,
    beginGame,
    cancelCountdown,
    closeHelp,
    dropNow,
    helpOpen,
    holdNow,
    moveDown,
    moveLeft,
    moveRight,
    paintClock,
    pauseNow,
    releaseHeldControls,
    replaceGame,
    rotateClockwise,
    rotateCounterClockwise,
    stopRepeat,
  ]);

  useEffect(() => () => {
    releaseHeldControls();
    if (calloutTimerRef.current) clearTimeout(calloutTimerRef.current);
  }, [releaseHeldControls]);

  const cells = useMemo<CellView[]>(() => {
    const rendered: CellView[] = game.board
      .slice(HIDDEN_ROWS)
      .flatMap((row) => row.map((type) => ({ type, mode: type ? "locked" : "empty" })));

    if (!game.active) return rendered;
    const landing = ghostY(game);
    const ghost = { ...game.active, y: landing };
    for (const [x, y] of getPieceCells(ghost)) {
      const visibleY = y - HIDDEN_ROWS;
      if (visibleY >= 0 && visibleY < VISIBLE_ROWS && rendered[visibleY * BOARD_WIDTH + x]?.type === null) {
        rendered[visibleY * BOARD_WIDTH + x] = { type: game.active.type, mode: "ghost" };
      }
    }
    for (const [x, y] of getPieceCells(game.active)) {
      const visibleY = y - HIDDEN_ROWS;
      if (visibleY >= 0 && visibleY < VISIBLE_ROWS) {
        rendered[visibleY * BOARD_WIDTH + x] = { type: game.active.type, mode: "active" };
      }
    }
    return rendered;
  }, [game]);

  const displayBest = Math.max(bestScore, game.score);
  const runTime = formatRunTime(elapsedMs);
  const pieceRate = formatPiecesPerSecond(game.pieces, elapsedMs);
  const controlsDisabled = game.status !== "playing";
  const statusLabel = countdown !== null
    ? "Calibrating"
    : game.status === "playing"
      ? "Run live"
      : game.status === "paused"
        ? "Run held"
        : game.status === "over"
          ? "Run complete"
          : "System ready";
  const boardLabel = `Tetris board. Score ${game.score}. Level ${game.level}. ${game.lines} lines. ${game.pieces} pieces. Time ${runTime}. ${game.status}.`;

  return (
    <main className="app-shell">
      <div className="ambient ambient--cyan" />
      <div className="ambient ambient--violet" />

      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true"><span /><span /><span /><span /></div>
          <div>
            <p>BLOCK//LINE</p>
            <span>Tetris system</span>
          </div>
        </div>

        <div className="system-status" aria-label={statusLabel}>
          <span className={`status-light status-light--${game.status}`} />
          <span>{statusLabel}</span>
        </div>

        <div className="header-score">
          <span>Score</span>
          <strong>{formatScore(game.score)}</strong>
        </div>

        <nav className="header-actions" aria-label="Game options">
          <button type="button" className="icon-button" onClick={openHelp} aria-label="Open controls and help">?</button>
          <button
            type="button"
            className={`icon-button${soundOn ? " is-active" : ""}`}
            onClick={() => setSoundOn((value) => !value)}
            aria-label={soundOn ? "Mute sound" : "Enable sound"}
            aria-pressed={soundOn}
          >
            {soundOn ? "SFX" : "OFF"}
          </button>
          <button
            type="button"
            className="icon-button mobile-pause-button"
            onClick={pauseNow}
            disabled={game.status === "ready" || game.status === "over"}
            aria-label={game.status === "paused" ? "Resume game" : "Pause game"}
          >
            {game.status === "paused" ? "▶" : "Ⅱ"}
          </button>
          <button
            type="button"
            className="text-button pause-button"
            onClick={pauseNow}
            disabled={game.status === "ready" || game.status === "over"}
          >
            {game.status === "paused" ? "Resume" : "Pause"}
          </button>
        </nav>
      </header>

      <section className="arena" aria-label="Blockline game console">
        <aside className="side-rail side-rail--left">
          <section className="panel hold-panel">
            <div className="panel-heading">
              <span>Hold</span>
              <Keycap>C</Keycap>
            </div>
            <div className={`preview-well${game.canHold ? "" : " is-locked"}`}>
              <MiniPiece type={game.hold} />
            </div>
            <p>{game.hold ? (game.canHold ? "Ready to swap" : "Locked this turn") : "Reserve a piece"}</p>
          </section>

          <section className="panel metrics-panel">
            <Metric label="Level" value={String(game.level).padStart(2, "0")} />
            <Metric label="Lines" value={String(game.lines).padStart(3, "0")} />
            <Metric label="Time" value={runTime} />
            <Metric label="PPS" value={pieceRate} />
          </section>

          <section className="panel controls-panel">
            <div className="panel-heading"><span>Controls</span></div>
            <div className="control-row"><span>Move</span><span><Keycap>←</Keycap><Keycap>→</Keycap></span></div>
            <div className="control-row"><span>Soft drop</span><Keycap>↓</Keycap></div>
            <div className="control-row"><span>Rotate</span><span><Keycap>Z</Keycap><Keycap>X</Keycap></span></div>
            <div className="control-row"><span>Hard drop</span><Keycap>Space</Keycap></div>
          </section>
        </aside>

        <section className="play-column">
          <div className="mobile-hud">
            <div className="mobile-preview">
              <span>Hold</span>
              <MiniPiece type={game.hold} compact />
            </div>
            <div className="mobile-metrics">
              <strong>L{String(game.level).padStart(2, "0")}</strong>
              <span>{game.lines}L · {runTime}</span>
            </div>
            <div className="mobile-preview">
              <span>Next</span>
              <MiniPiece type={game.queue[0] ?? null} compact />
            </div>
          </div>

          <div className={`board-frame${game.lastClear ? " has-clear" : ""}`} key={`frame-${game.clearSerial}`}>
            <div className="board-topline">
              <span>Playfield / 10×20</span>
              <span>{game.status === "playing" ? "Live" : game.status}</span>
            </div>
            <div className="board" role="group" aria-label={boardLabel}>
              {cells.map((cell, index) => (
                <span
                  aria-hidden="true"
                  className={`board-cell cell-${cell.mode}${cell.type ? ` piece-${cell.type}` : ""}`}
                  key={index}
                />
              ))}

              {callout && game.status === "playing" && (
                <div className="game-callout" key={callout.id} aria-hidden="true">{callout.text}</div>
              )}

              {game.status !== "playing" && (
                <div className="game-overlay">
                  {game.status === "ready" && countdown === null && (
                    <>
                      <span className="overlay-kicker">Tournament mode</span>
                      <h1>Make space.</h1>
                      <p>Stack clean. Stay calm. Own the board.</p>
                      <button type="button" className="primary-button" onClick={beginGame}>Play now <span>↗</span></button>
                      <small>or press Enter</small>
                    </>
                  )}
                  {game.status === "ready" && countdown !== null && (
                    <div className="countdown">
                      <span className="overlay-kicker">Run initializing</span>
                      <strong key={countdown}>{countdown === 0 ? "GO" : countdown}</strong>
                      <small>Eyes up. Stack clean.</small>
                    </div>
                  )}
                  {game.status === "paused" && (
                    <>
                      <span className="overlay-kicker">Session held</span>
                      <h2>Paused.</h2>
                      <p>Your run is frozen exactly where you left it.</p>
                      <div className="overlay-actions">
                        <button type="button" className="primary-button" onClick={pauseNow}>Resume <span>▶</span></button>
                        <button type="button" className="secondary-button" onClick={beginGame}>New run</button>
                      </div>
                    </>
                  )}
                  {game.status === "over" && (
                    <>
                      <span className="overlay-kicker">Run complete</span>
                      <h2>{formatScore(game.score)}</h2>
                      <p className="result-label">Final score · Level {game.level}</p>
                      <div className="overlay-stats">
                        <div><span>Lines</span><strong>{game.lines}</strong></div>
                        <div><span>Time</span><strong>{runTime}</strong></div>
                        <div><span>Pieces</span><strong>{game.pieces}</strong></div>
                        <div><span>PPS</span><strong>{pieceRate}</strong></div>
                      </div>
                      <button type="button" className="primary-button" onClick={beginGame}>Run it back <span>↻</span></button>
                      <small>Best {formatScore(displayBest)}</small>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="board-footer">
              <div><span>Mode</span><strong>Marathon</strong></div>
              <div className="clear-message" aria-hidden={!game.lastClear}>
                {game.lastClear ?? (game.combo > 0 ? `${game.combo + 1}× combo` : "Focus")}
              </div>
              <div><span>Gravity</span><strong>{(1000 / gravityInterval(game.level)).toFixed(1)}×</strong></div>
            </div>
          </div>
        </section>

        <aside className="side-rail side-rail--right">
          <section className="panel next-panel">
            <div className="panel-heading"><span>Next</span><span>5 queue</span></div>
            <div className="next-list">
              {game.queue.slice(0, 5).map((type, index) => (
                <div className={`next-item${index === 0 ? " is-next" : ""}`} key={`${type}-${index}`}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <MiniPiece type={type} compact={index > 0} />
                </div>
              ))}
            </div>
          </section>

          <section className="panel score-panel">
            <span>Score</span>
            <strong>{formatScore(game.score)}</strong>
            <div><span>Personal best</span><b>{formatScore(displayBest)}</b></div>
            <div><span>Run clock</span><b>{runTime}</b></div>
            <div><span>Piece rate</span><b>{pieceRate} PPS</b></div>
          </section>
        </aside>
      </section>

      <section className="touch-controls" aria-label="Touch controls">
        <div className="touch-cluster touch-cluster--move">
          <RepeatButton label="Left" symbol="←" disabled={controlsDisabled} onStart={() => beginRepeat("touch-left", moveLeft)} onStop={() => stopRepeat("touch-left")} />
          <RepeatButton label="Down" symbol="↓" disabled={controlsDisabled} onStart={() => beginRepeat("touch-down", moveDown)} onStop={() => stopRepeat("touch-down")} />
          <RepeatButton label="Right" symbol="→" disabled={controlsDisabled} onStart={() => beginRepeat("touch-right", moveRight)} onStop={() => stopRepeat("touch-right")} />
        </div>
        <div className="touch-cluster touch-cluster--actions">
          <ActionButton label="Hold" symbol="□" disabled={controlsDisabled} className="touch-button--secondary" onAction={holdNow} />
          <ActionButton label="Rotate" symbol="↻" disabled={controlsDisabled} className="touch-button--primary" onAction={rotateClockwise} />
          <ActionButton label="Drop" symbol="⇊" disabled={controlsDisabled} className="touch-button--drop" onAction={dropNow} />
        </div>
      </section>

      <div className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</div>

      {helpOpen && (
        <div className="dialog-backdrop" role="presentation" onPointerDown={closeHelp}>
          <section
            ref={helpDialogRef}
            className="help-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="dialog-heading">
              <div><span>Field manual</span><h2 id="help-title">How to play</h2></div>
              <button ref={helpCloseButtonRef} type="button" className="icon-button" onClick={closeHelp} aria-label="Close help">×</button>
            </div>
            <p>Complete horizontal lines without letting the stack reach the top. Every ten lines increases the level and gravity.</p>
            <div className="help-grid">
              <div><Keycap>←</Keycap><Keycap>→</Keycap><span>Move</span></div>
              <div><Keycap>↓</Keycap><span>Soft drop</span></div>
              <div><Keycap>↑</Keycap><Keycap>X</Keycap><span>Rotate right</span></div>
              <div><Keycap>Z</Keycap><span>Rotate left</span></div>
              <div><Keycap>Space</Keycap><span>Hard drop</span></div>
              <div><Keycap>C</Keycap><Keycap>Shift</Keycap><span>Hold</span></div>
              <div><Keycap>P</Keycap><Keycap>Esc</Keycap><span>Pause</span></div>
              <div><Keycap>M</Keycap><span>Sound</span></div>
            </div>
            <div className="scoring-note"><strong>Score smarter</strong><span>Hard drops earn 2 points per row. Consecutive clears build combos; back-to-back Tetrises earn 1.5×.</span></div>
            <button
              type="button"
              className="help-setting"
              onClick={() => setSoundOn((value) => !value)}
              aria-pressed={soundOn}
            >
              <span>Sound effects</span><strong>{soundOn ? "On" : "Off"}</strong>
            </button>
            <button type="button" className="primary-button dialog-close" onClick={closeHelp}>Back to the board</button>
          </section>
        </div>
      )}
    </main>
  );
}
