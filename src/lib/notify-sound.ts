// Short "new order" chime shared by the admin orders page and the courier
// dashboard — a couple of quick sine-tone beeps via the Web Audio API,
// rather than a static audio file, so there's nothing extra to ship/load
// and no autoplay-blocked <audio> element to fight with. Browsers require
// an AudioContext to be created/resumed after a user gesture, so the very
// first click anywhere on the page (handled by callers) is what actually
// unlocks sound; before that, playNewOrderChime() just silently no-ops if
// the context can't start.
let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

function beep(audioCtx: AudioContext, freq: number, startTime: number, duration: number) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(0.35, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

// Two ascending tones — deliberately short and simple so it reads as an
// alert without being jarring on repeat during a busy shift.
export function playNewOrderChime() {
  const audioCtx = getContext();
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  beep(audioCtx, 880, now, 0.16);
  beep(audioCtx, 1175, now + 0.14, 0.22);
}
