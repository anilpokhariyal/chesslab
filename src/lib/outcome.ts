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

export function outcome(fen: string, pgn?: string): Outcome | null {
  try {
    const g = loadGame(pgn, fen);
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
