export type Grade =
  | "book"
  | "brilliant"
  | "best"
  | "good"
  | "inaccuracy"
  | "mistake"
  | "blunder";

export const GRADE_ORDER: Grade[] = ["book", "brilliant", "best", "good", "inaccuracy", "mistake", "blunder"];

export function classifyMove(opts: {
  cpl: number;
  isBest: boolean;
  isSacrifice: boolean;
}): Grade {
  if (opts.isBest && opts.isSacrifice) return "brilliant";
  if (opts.cpl <= 10) return "best";
  if (opts.cpl <= 50) return "good";
  if (opts.cpl <= 100) return "inaccuracy";
  if (opts.cpl <= 200) return "mistake";
  return "blunder";
}

/** Chess.com-ish per-move accuracy from centipawn loss. */
export function moveAccuracy(cpl: number): number {
  const n = 103.1668 * Math.exp(-0.04354 * Math.max(0, cpl)) - 3.1669;
  return Math.max(0, Math.min(100, n));
}

export function mean(xs: number[]): number {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export const GRADE_LABEL: Record<Grade, string> = {
  book: "Book",
  brilliant: "Excellent",
  best: "Best",
  good: "Good",
  inaccuracy: "Inaccuracy",
  mistake: "Mistake",
  blunder: "Blunder",
};

export function nextGradePly(grades: string[], ply: number, grade: string): number | null {
  const plies = grades.flatMap((g, i) => (g === grade ? [i + 1] : []));
  return plies.find((p) => p > ply) ?? plies[0] ?? null;
}

export const GRADE_GLYPH: Record<Grade, string> = {
  book: "Book",
  brilliant: "!!",
  best: "!",
  good: "",
  inaccuracy: "?!",
  mistake: "?",
  blunder: "??",
};

export function faultCopy(played: string, best: string, grade: Grade, cpl: number, punish: string, line: string) {
  const mild = cpl <= 50;
  return {
    title: mild ? "Not the suggestion" : GRADE_LABEL[grade],
    grade: mild ? ("good" as Grade) : grade,
    why: mild
      ? `You played ${played} instead of ${best}. The engine's first choice is ${best}.`
      : `You played ${played} instead of ${best}. That costs about ${cpl} centipawns — a ${GRADE_LABEL[grade].toLowerCase()}.`,
    punish: punish
      ? `The other side can ${mild ? "continue" : "punish"} with ${punish}${line ? `. Idea: ${line}` : "."}`
      : "The engine is still looking for the reply.",
  };
}
