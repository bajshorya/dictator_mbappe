// Lightweight Web Audio sound effects — synthesised, no asset files.
// Respects a persisted mute flag and is fully guarded for SSR.

const KEY = "footy:muted";
let ctx: AudioContext | null = null;
let muted = false;

if (typeof window !== "undefined") {
  try {
    muted = window.localStorage.getItem(KEY) === "1";
  } catch {
    /* ignore */
  }
}

export function isMuted(): boolean {
  return muted;
}
export function setMuted(v: boolean) {
  muted = v;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  }
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

function tone(freq: number, start: number, dur: number, type: OscillatorType, gain = 0.15) {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + start;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function play(fn: () => void) {
  if (muted) return;
  const ac = audio();
  if (!ac) return;
  if (ac.state === "suspended") ac.resume().catch(() => {});
  fn();
}

export const sound = {
  goal: () => play(() => {
    tone(523, 0, 0.12, "triangle", 0.2);
    tone(659, 0.1, 0.12, "triangle", 0.2);
    tone(880, 0.2, 0.22, "triangle", 0.22);
  }),
  miss: () => play(() => tone(180, 0, 0.25, "sawtooth", 0.14)),
  whistle: () => play(() => tone(2000, 0, 0.18, "square", 0.06)),
  tap: () => play(() => tone(440, 0, 0.05, "square", 0.08)),
  win: () => play(() => {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.13, 0.2, "triangle", 0.2));
  }),
  lose: () => play(() => {
    [392, 330, 262].forEach((f, i) => tone(f, i * 0.16, 0.28, "sawtooth", 0.14));
  }),
};
