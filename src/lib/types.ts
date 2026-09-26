import type { Grade } from "./classify";
import type { SoundPrefs } from "./sound";

export type Plan = "free" | "premium" | "coach";

export type Score = { type: "cp" | "mate"; value: number };

export type PvLine = {
  moves: string[];
  score: Score;
};

export type PositionEval = {
  fen: string;
  bestMove: string;
  score: Score;
  pvs: PvLine[];
};

export type AnalyzedMove = {
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
  color: "w" | "b";
  cpl: number;
  grade: Grade;
  bestSan: string;
  bestUci: string;
  evalBefore: Score;
  evalAfter: Score;
};

export type SavedAnalysis = {
  id: string;
  at: number;
  white: string;
  black: string;
  result: string;
  pgn: string;
  opening?: string;
  moves: AnalyzedMove[];
  whiteAccuracy: number;
  blackAccuracy: number;
  whiteAcpl: number;
  blackAcpl: number;
};

export type GameDraft = {
  opp: string;
  elo: number;
  side: "w" | "b";
  fen: string;
  pgn: string;
  status: string;
  mode?: "play" | "basics" | "full";
  log?: { who: "you" | "bot" | "sys"; text: string; san?: string; grade?: string; ply?: number }[];
};

export type PlayedGame = {
  id: string;
  at: number;
  kind: "play" | "coach";
  pgn: string;
  result: string;
  opp: string;
};

export type OpeningProgress = { ch: number; ply: number };

export type Profile = {
  name: string;
  plan: Plan;
  puzzleRating: number;
  streak: number;
  solved: number;
  failed: number;
  bestStreak: number;
  theme: string;
  sounds: SoundPrefs;
  analyses: SavedAnalysis[];
  lastAnalysisId: string | null;
  games: PlayedGame[];
  play: GameDraft | null;
  coach: GameDraft | null;
  openings: Record<string, OpeningProgress>;
  coordBest: number;
  chessCom: string;
  lichess: string;
};
