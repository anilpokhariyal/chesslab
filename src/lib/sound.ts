export const SOUND_KEYS = ["move", "capture", "check", "end"] as const;
export type SoundKey = (typeof SOUND_KEYS)[number];

export type SoundPrefs = Record<SoundKey, boolean> & { volume: number };

export const DEFAULT_SOUNDS: SoundPrefs = { move: true, capture: true, check: true, end: true, volume: 0.7 };

const TONE: Record<SoundKey, [number, number, number]> = {
  move: [290, 130, 0.1],
  capture: [170, 80, 0.12],
  check: [520, 240, 0.16],
  end: [200, 90, 0.28],
};

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  ctx ??= new AudioContext();
  void ctx.resume();
  return ctx;
}

if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", () => audio(), { once: true });
}

export function piecesIn(fen: string): number {
  return fen.split(" ")[0].replace(/[^a-zA-Z]/g, "").length;
}

export function whichSound(
  prev: string,
  fen: string,
  s: SoundPrefs,
  note: { kind: "check" | "end" } | null,
): SoundKey | null {
  if (prev.split(" ")[0] === fen.split(" ")[0]) return null;
  const capture = piecesIn(fen) < piecesIn(prev);
  if (note?.kind === "end") return s.end ? "end" : null;
  if (note?.kind === "check") return s.check ? "check" : capture && s.capture ? "capture" : s.move ? "move" : null;
  if (capture) return s.capture ? "capture" : s.move ? "move" : null;
  return s.move ? "move" : null;
}

export function playSound(kind: SoundKey, volume: number): void {
  const ac = audio();
  if (!ac || volume <= 0) return;
  const [from, to, dur] = TONE[kind];
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  gain.gain.setValueAtTime(0.2 * volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur + 0.01);
}
