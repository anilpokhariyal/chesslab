import { GRADE_LABEL } from "./classify";
import type { AnalyzedMove, SavedAnalysis, Score } from "./types";
import { formatScore, scoreToWhiteCp } from "./engine";

export type CoachMode = "play" | "basics" | "full";

export function sideCpl(before: Score, after: Score, color: "w" | "b"): number {
  const best = scoreToWhiteCp(before);
  const played = scoreToWhiteCp(after);
  const signedBest = color === "w" ? best : -best;
  const signedPlayed = color === "w" ? played : -played;
  return Math.max(0, Math.round(signedBest - signedPlayed));
}

export function botPlan(played: string, best: string, line: string): string {
  const idea = line ? ` Plan: ${line}.` : "";
  if (!best || played === best) return `I played ${played}.${idea}`;
  return `I played ${played}.${idea} The computer prefers ${best} here — try to stop that idea.`;
}

export function explainMove(m: AnalyzedMove, ply: number): string {
  const n = Math.ceil(ply / 2);
  const who = m.color === "w" ? "White" : "Black";
  const grade = GRADE_LABEL[m.grade];
  if (m.grade === "best" || m.grade === "brilliant") {
    return `${who}'s ${n}… ${m.san} is a ${grade.toLowerCase()} move (${formatScore(m.evalAfter)}).`;
  }
  return `${who}'s ${n}… ${m.san} is a ${grade.toLowerCase()} (${formatScore(m.evalAfter)}, ${m.cpl}cp loss). Best was ${m.bestSan}.`;
}

export function summarize(a: SavedAnalysis): string[] {
  const worst = [...a.moves].sort((x, y) => y.cpl - x.cpl).slice(0, 5);
  const lines = [
    `${a.white} vs ${a.black} (${a.result}). Accuracy ${a.whiteAccuracy.toFixed(1)} / ${a.blackAccuracy.toFixed(1)}. ACPL ${a.whiteAcpl.toFixed(0)} / ${a.blackAcpl.toFixed(0)}.`,
  ];
  if (a.opening) lines.push(`Opening: ${a.opening}.`);
  for (const m of worst) {
    if (m.cpl < 50) continue;
    lines.push(explainMove(m, a.moves.indexOf(m) + 1));
  }
  if (lines.length === 1) lines.push("Clean game — no big swings to talk about.");
  return lines;
}

export function answer(a: SavedAnalysis, q: string): string {
  const num = q.match(/\b(\d+)\b/);
  if (num) {
    const n = Number(num[1]);
    const idxs = [n * 2 - 2, n * 2 - 1].filter((i) => a.moves[i]);
    if (idxs.length) return idxs.map((i) => explainMove(a.moves[i], i + 1)).join(" ");
  }
  const side = /black/i.test(q) ? "b" : /white/i.test(q) ? "w" : null;
  if (/blunder|mistake|worst/i.test(q)) {
    const pool = a.moves.filter((m) => !side || m.color === side);
    const worst = pool.sort((x, y) => y.cpl - x.cpl)[0];
    if (worst) return explainMove(worst, a.moves.indexOf(worst) + 1);
  }
  return summarize(a).join(" ");
}
