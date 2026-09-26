import { Chess, type Square } from "chess.js";

export type PromoPiece = "q" | "r" | "b" | "n";

export function needsPromo(fen: string, from: string, to: string): boolean {
  try {
    return new Chess(fen)
      .moves({ square: from as Square, verbose: true })
      .some((m) => m.to === to && !!m.promotion);
  } catch {
    return false;
  }
}
