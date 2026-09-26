import { Chess } from "chess.js";
import { classifyMove, mean, moveAccuracy } from "./classify";
import { cloudEval, openingName } from "./api";
import {
  formatScore,
  getEngine,
  isCaptureSacrifice,
  scoreToWhiteCp,
  uciToSan,
} from "./engine";
import type { AnalyzedMove, PositionEval, SavedAnalysis, Score } from "./types";

function cloudToEval(fen: string, cloud: { pvs: { moves: string; cp?: number; mate?: number }[] }): PositionEval {
  const turn = fen.split(" ")[1] === "b" ? "b" : "w";
  const sign = turn === "w" ? 1 : -1;
  const pvs = cloud.pvs.map((p) => {
    const score: Score =
      p.mate !== undefined ? { type: "mate", value: sign * p.mate } : { type: "cp", value: sign * (p.cp ?? 0) };
    return { moves: p.moves.trim().split(/\s+/), score };
  });
  return { fen, bestMove: pvs[0]?.moves[0] ?? "", score: pvs[0]?.score ?? { type: "cp", value: 0 }, pvs };
}

export async function evalPosition(fen: string, depth: number): Promise<PositionEval> {
  const cloud = await cloudEval(fen);
  if (cloud && cloud.depth >= Math.min(depth, 12)) return cloudToEval(fen, cloud);
  return getEngine().analyze(fen, depth, 3);
}

export async function analyzeGame(
  pgn: string,
  depth: number,
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<SavedAnalysis> {
  const game = new Chess();
  game.loadPgn(pgn);
  const header = game.header();
  const verbose = game.history({ verbose: true });
  const startFen = verbose[0]?.before ?? new Chess().fen();
  const replay = new Chess(startFen.includes(" ") ? startFen : undefined);
  if (verbose[0]?.before) replay.load(verbose[0].before);

  const fens = [replay.fen()];
  for (const m of verbose) {
    replay.move(m);
    fens.push(replay.fen());
  }

  const evals: PositionEval[] = [];
  for (let i = 0; i < fens.length; i++) {
    if (signal?.aborted) throw new DOMException("cancelled", "AbortError");
    evals.push(await evalPosition(fens[i], depth));
    onProgress?.(i + 1, fens.length);
  }

  const moves: AnalyzedMove[] = verbose.map((m, i) => {
    const before = evals[i];
    const after = evals[i + 1];
    const side = m.color;
    const best = scoreToWhiteCp(before.score);
    const played = scoreToWhiteCp(after.score);
    const signedBest = side === "w" ? best : -best;
    const signedPlayed = side === "w" ? played : -played;
    const cpl = Math.max(0, Math.round(signedBest - signedPlayed));
    const uci = `${m.from}${m.to}${m.promotion ?? ""}`;
    const isBest = uci === before.bestMove || m.san === uciToSan(fens[i], before.bestMove);
    return {
      san: m.san,
      uci,
      fenBefore: fens[i],
      fenAfter: fens[i + 1],
      color: side,
      cpl,
      grade: classifyMove({ cpl, isBest, isSacrifice: isBest && isCaptureSacrifice(fens[i], uci) }),
      bestSan: uciToSan(fens[i], before.bestMove),
      bestUci: before.bestMove,
      evalBefore: before.score,
      evalAfter: after.score,
    };
  });

  const white = moves.filter((x) => x.color === "w");
  const black = moves.filter((x) => x.color === "b");
  const opening = (await openingName(fens[Math.min(8, fens.length - 1)])) ?? undefined;

  return {
    id: `${Date.now()}`,
    at: Date.now(),
    white: header.White ?? "White",
    black: header.Black ?? "Black",
    result: header.Result ?? "*",
    pgn,
    opening,
    moves,
    whiteAccuracy: mean(white.map((m) => moveAccuracy(m.cpl))),
    blackAccuracy: mean(black.map((m) => moveAccuracy(m.cpl))),
    whiteAcpl: mean(white.map((m) => m.cpl)),
    blackAcpl: mean(black.map((m) => m.cpl)),
  };
}

export { formatScore };
