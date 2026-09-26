import type { SavedAnalysis } from "./types";

export type SkillKey = "opening" | "tactics" | "conversion" | "endgame" | "consistency";

export type SkillScores = Record<SkillKey, number>;

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

function pieceCount(fen: string): number {
  return fen.split(" ")[0].replace(/[^prnbqkPRNBQK]/g, "").length;
}

export function skillScores(games: SavedAnalysis[]): SkillScores {
  if (!games.length) {
    return { opening: 50, tactics: 50, conversion: 50, endgame: 50, consistency: 50 };
  }
  let openAcc = 0;
  let openN = 0;
  let blunders = 0;
  let moves = 0;
  let convertOk = 0;
  let convertN = 0;
  let endAcc = 0;
  let endN = 0;
  let acpl = 0;

  for (const g of games) {
    acpl += (g.whiteAcpl + g.blackAcpl) / 2;
    g.moves.forEach((m, i) => {
      moves++;
      if (m.grade === "blunder") blunders++;
      if (i < 16) {
        openAcc += 100 - Math.min(100, m.cpl);
        openN++;
      }
      if (pieceCount(m.fenBefore) <= 12) {
        endAcc += 100 - Math.min(100, m.cpl);
        endN++;
      }
      if (m.evalBefore.type === "cp" && Math.abs(m.evalBefore.value) >= 200) {
        convertN++;
        if (m.cpl < 80) convertOk++;
      }
    });
  }

  return {
    opening: clamp(openN ? openAcc / openN : 50),
    tactics: clamp(100 - (moves ? (blunders / moves) * 800 : 50)),
    conversion: clamp(convertN ? (convertOk / convertN) * 100 : 50),
    endgame: clamp(endN ? endAcc / endN : 50),
    consistency: clamp(100 - acpl / games.length / 3),
  };
}

export const SKILL_LABEL: Record<SkillKey, string> = {
  opening: "Opening",
  tactics: "Tactics",
  conversion: "Conversion",
  endgame: "Endgame",
  consistency: "Consistency",
};
