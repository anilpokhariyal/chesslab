import assert from "node:assert/strict";
import {
  formatScore,
  getEngine,
  isCaptureSacrifice,
  normalizeUci,
  pvToSan,
  scoreToWhiteCp,
  uciToSan,
} from "./engine.ts";

assert.equal(scoreToWhiteCp({ type: "cp", value: 35 }), 35);
assert.equal(scoreToWhiteCp({ type: "mate", value: 2 }), 9998);
assert.equal(scoreToWhiteCp({ type: "mate", value: -3 }), -9997);
assert.equal(formatScore({ type: "mate", value: 2 }), "M2");
assert.equal(formatScore({ type: "cp", value: 35 }), "+0.35");
assert.equal(formatScore({ type: "cp", value: -12 }), "-0.12");
assert.equal(normalizeUci("e1h1"), "e1g1");
assert.equal(normalizeUci("e1a1"), "e1c1");
assert.equal(normalizeUci("e8h8"), "e8g8");
assert.equal(normalizeUci("e8a8q"), "e8c8q");
assert.equal(normalizeUci("e2e4"), "e2e4");

const start = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
assert.equal(pvToSan(start, ["e2e4", "e7e5", "g1f3"]), "e4 e5 Nf3");
assert.equal(pvToSan("not-a-fen", ["e2e4"]), "e2e4");
assert.equal(pvToSan(start, ["zzzz", "e2e4"]), "");
assert.equal(uciToSan(start, "e2e4"), "e4");
assert.equal(uciToSan(start, ""), "");
assert.equal(uciToSan(start, "(none)"), "");
assert.equal(uciToSan(start, "e2e5"), "e2e5");
assert.equal(uciToSan("not-a-fen", "e2e4"), "e2e4");
assert.equal(isCaptureSacrifice(start, "e2e4"), false);
assert.equal(isCaptureSacrifice("not-a-fen", "e2e4"), false);
assert.equal(isCaptureSacrifice("4k3/8/8/3p4/8/8/8/3QK3 w - - 0 1", "d1d5"), true);

class FakeWorker {
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: ((e: { message?: string }) => void) | null = null;
  listeners = new Set<(e: { data: string }) => void>();
  addEventListener(_t: string, fn: (e: { data: string }) => void) {
    this.listeners.add(fn);
  }
  removeEventListener(_t: string, fn: (e: { data: string }) => void) {
    this.listeners.delete(fn);
  }
  postMessage(msg: unknown) {
    const emit = (data: string) => {
      const ev = { data };
      this.onmessage?.(ev);
      for (const fn of this.listeners) fn(ev);
    };
    queueMicrotask(() => {
      const m = String(msg);
      if (m === "uci") emit("uciok");
      else if (m === "isready") emit("readyok");
      else if (m.startsWith("go")) {
        emit("info depth 1 time 1");
        emit("info depth 1 score cp 25 multipv 1 pv e2e4 e7e5");
        emit("info depth 1 score mate 4 multipv 2 pv d2d4");
        emit("bestmove e1h1");
      }
    });
  }
}
(globalThis as { Worker?: unknown }).Worker = FakeWorker;

export async function run(): Promise<void> {
  const black = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
  const ev = await getEngine().analyze(start, 8, 3);
  assert.equal(ev.bestMove, "e1g1");
  assert.equal(ev.pvs[0]?.score.type, "cp");
  const evb = await getEngine().analyze(black, 6);
  assert.equal(evb.score.type, "cp");
  assert.equal(await getEngine().bestMove(start, { depth: 6 }), "e1g1");
  assert.equal(await getEngine().bestMove(start, { elo: 1200, movetime: 50 }), "e1g1");
  getEngine().stop();
  console.log("engine ok");
}
