export function formatRunTime(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${totalMinutes}:${String(seconds).padStart(2, "0")}`;
}

export function piecesPerSecond(pieces: number, milliseconds: number): number {
  if (!Number.isFinite(pieces) || !Number.isFinite(milliseconds) || pieces <= 0 || milliseconds <= 0) {
    return 0;
  }
  return pieces / (milliseconds / 1000);
}

export function formatPiecesPerSecond(pieces: number, milliseconds: number): string {
  return piecesPerSecond(pieces, milliseconds).toFixed(2);
}

export function countdownDelay(step: number): number {
  return step === 0 ? 500 : 1000;
}

export function nextCountdownStep(step: number): number | null {
  return step > 0 ? step - 1 : null;
}
