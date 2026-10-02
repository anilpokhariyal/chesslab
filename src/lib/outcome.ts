import { Chess } from "chess.js";

export type Outcome = { kind: "check" | "end"; text: string };

export function loadGame(pgn?: string, fen?: string): Chess {
  if (pgn) {
    try {
      const g = new Chess();
      g.loadPgn(pgn);
      return g;
    } catch {
      /* fen */
    }
  }
  if (fen) {
    try {
      return new Chess(fen);
    } catch {
      /* start */
    }
  }
  return new Chess();
}

export function cloneGame(g: Chess): Chess {
  return loadGame(g.pgn(), g.fen());
}

/** Position at `fen`. PGN is only the history up to that ply, so a later mate does not leak backward. */
function gameAt(fen: string, pgn?: string): Chess | null {
  if (pgn) {
    try {
      const full = new Chess();
      full.loadPgn(pgn);
      if (full.fen() === fen) return full;
      const moves = full.history({ verbose: true });
      const replay = new Chess(moves[0]?.before);
      if (replay.fen() === fen) return replay;
      for (const m of moves) {
        replay.move(m.san);
        if (replay.fen() === fen) return replay;
      }
    } catch {
      /* fen */
    }
  }
  try {
    return new Chess(fen);
  } catch {
    return null;
  }
}

export function outcome(fen: string, pgn?: string): Outcome | null {
  const g = gameAt(fen, pgn);
  if (!g) return null;
  try {
    if (g.isCheckmate()) return { kind: "end", text: "Checkmate" };
    if (g.isStalemate()) return { kind: "end", text: "Stalemate" };
    if (g.isThreefoldRepetition()) return { kind: "end", text: "Draw by repetition" };
    if (g.isInsufficientMaterial()) return { kind: "end", text: "Draw — insufficient material" };
    if (g.isDraw()) return { kind: "end", text: "Draw" };
    if (g.isCheck()) return { kind: "check", text: "Check" };
    return null;
  } catch {
    return null;
  }
}
