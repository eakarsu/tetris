export type ResumableAudioContext = {
  state: string;
  resume: () => Promise<void>;
};

export async function resumeAudioContext(context: ResumableAudioContext): Promise<boolean> {
  if (context.state === "running") return true;
  if (context.state === "closed") return false;

  try {
    await context.resume();
  } catch {
    return false;
  }

  return context.state === "running";
}
