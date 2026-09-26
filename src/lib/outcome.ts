import { Chess } from "chess.js";

export type Outcome = { kind: "check" | "end"; text: string };

export function outcome(fen: string): Outcome | null {
  try {
    const g = new Chess(fen);
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
