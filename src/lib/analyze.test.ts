import assert from "node:assert/strict";
import { analyzeGame, evalPosition, formatScore } from "./analyze.ts";

assert.equal(formatScore({ type: "cp", value: 100 }), "+1.00");

const start = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export async function run(): Promise<void> {
(globalThis as { fetch: typeof fetch }).fetch = (async (input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes("cloud-eval") && url.includes("shallow")) {
    return { ok: true, status: 200, json: async () => ({ depth: 4, pvs: [{ moves: "e2e4", cp: 10 }] }) };
  }
  if (url.includes("cloud-eval") && url.includes("fail")) {
    return { ok: false, status: 500, json: async () => ({}) };
  }
  if (url.includes("cloud-eval")) {
    const fen = decodeURIComponent(url.split("fen=")[1]?.split("&")[0] ?? "");
    const black = fen.includes(" b ");
    return {
      ok: true,
      status: 200,
      json: async () => ({
        depth: 18,
        pvs: black
          ? [{ moves: "e7e5", cp: 20 }]
          : [{ moves: "e2e4 e7e5", cp: 25 }, { moves: "d2d4", mate: 4 }],
      }),
    };
  }
  if (url.includes("explorer")) {
    return { ok: true, status: 200, json: async () => ({ opening: { eco: "C20", name: "King's Pawn Game" } }) };
  }
  return { ok: false, status: 404, json: async () => ({}) };
}) as typeof fetch;

  const ev = await evalPosition(start, 12);
  assert.equal(ev.bestMove, "e2e4");
  const mate = await evalPosition("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1", 12);
  assert.equal(mate.score.type, "cp");

  const pgn = `[White "A"]\n[Black "B"]\n[Result "1-0"]\n\n1. e4 e5`;
  let seen = 0;
  const a = await analyzeGame(pgn, 12, (done, total) => {
    seen = done;
    assert.ok(total >= 2);
  });
  assert.equal(a.white, "A");
  assert.equal(a.black, "B");
  assert.equal(a.result, "1-0");
  assert.equal(a.moves.length, 2);
  assert.equal(a.opening, "C20 King's Pawn Game");
  assert.ok(seen >= 2);

  const ac = new AbortController();
  ac.abort();
  await assert.rejects(() => analyzeGame(pgn, 12, undefined, ac.signal), /cancelled|AbortError/);

  await evalPosition("shallow", 12);
  await evalPosition("fail", 12);
  console.log("analyze ok");
}
