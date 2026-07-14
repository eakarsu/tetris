export type RepeatScheduler = {
  setDelay: (callback: () => void, milliseconds: number) => unknown;
  clearDelay: (handle: unknown) => void;
  setRepeating: (callback: () => void, milliseconds: number) => unknown;
  clearRepeating: (handle: unknown) => void;
};

type RepeatEntry = {
  delay: unknown;
  interval: unknown | null;
};

const browserScheduler: RepeatScheduler = {
  setDelay: (callback, milliseconds) => setTimeout(callback, milliseconds),
  clearDelay: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  setRepeating: (callback, milliseconds) => setInterval(callback, milliseconds),
  clearRepeating: (handle) => clearInterval(handle as ReturnType<typeof setInterval>),
};

export function createRepeatController(
  scheduler: RepeatScheduler = browserScheduler,
  dasMilliseconds = 165,
  arrMilliseconds = 48,
) {
  const active = new Map<string, RepeatEntry>();

  const stop = (key: string) => {
    const entry = active.get(key);
    if (!entry) return;
    scheduler.clearDelay(entry.delay);
    if (entry.interval !== null) scheduler.clearRepeating(entry.interval);
    active.delete(key);
  };

  const stopAll = () => {
    [...active.keys()].forEach(stop);
  };

  const start = (key: string, action: () => void) => {
    if (active.has(key)) return false;
    action();
    const entry: RepeatEntry = { delay: null, interval: null };
    active.set(key, entry);
    entry.delay = scheduler.setDelay(() => {
      const current = active.get(key);
      if (!current) return;
      current.interval = scheduler.setRepeating(action, arrMilliseconds);
    }, dasMilliseconds);
    return true;
  };

  return {
    start,
    stop,
    stopAll,
    isActive: (key: string) => active.has(key),
  };
}
