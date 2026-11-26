let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      // A compressor in front of the speakers lets the alarm run at full
      // volume without clipping/distorting into a crackle.
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -6;
      comp.ratio.value = 4;
      master = ctx.createGain();
      master.gain.value = 1;
      master.connect(comp);
      comp.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

// Browsers only allow sound after the user has clicked/tapped the page once.
// Call this from any click handler; it returns whether sound is now allowed.
export async function unlockAudio(): Promise<boolean> {
  const audioCtx = getContext();
  if (!audioCtx) return false;
  try {
    await audioCtx.resume();
  } catch {
    // ignore
  }
  return audioCtx.state === "running";
}

export function isAudioReady(): boolean {
  return ctx !== null && ctx.state === "running";
}

function tone(
  audioCtx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  type: OscillatorType = "square",
  peak = 0.9
) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(peak, startTime + 0.01);
  gain.gain.setValueAtTime(peak, startTime + Math.max(0.01, duration - 0.02));
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  osc.connect(gain);
  gain.connect(master ?? audioCtx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.01);
}

export function playNewOrderChime() {
  const audioCtx = getContext();
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  tone(audioCtx, 880, now, 0.16, "sine", 0.35);
  tone(audioCtx, 1175, now + 0.14, 0.22, "sine", 0.35);
}

// One loud "S-O-S" in Morse (··· ––– ···) followed by a short two-tone
// siren sweep. Takes ~2.6 seconds; the caller repeats it until the order is
// opened.
export const SOS_PATTERN_MS = 3200;

export function playSosAlarm() {
  const audioCtx = getContext();
  if (!audioCtx) return;
  let t = audioCtx.currentTime + 0.02;
  const dot = 0.11;
  const dash = 0.33;
  const gap = 0.09;
  const freq = 1250;
  const pattern = [dot, dot, dot, dash, dash, dash, dot, dot, dot];
  pattern.forEach((len, i) => {
    tone(audioCtx, freq, t, len);
    // A quieter octave-down layer makes it sound fuller on small tablet speakers.
    tone(audioCtx, freq / 2, t, len, "sawtooth", 0.35);
    t += len + gap;
    if (i === 2 || i === 5) t += 0.12;
  });
  t += 0.15;
  for (let i = 0; i < 2; i++) {
    tone(audioCtx, 960, t, 0.22);
    tone(audioCtx, 720, t + 0.22, 0.22);
    t += 0.44;
  }
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate([100, 80, 100, 80, 100, 200, 300, 80, 300, 80, 300, 200, 100, 80, 100, 80, 100]);
    } catch {
      // ignore
    }
  }
}
