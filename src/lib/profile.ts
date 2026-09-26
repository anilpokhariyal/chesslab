import type { Profile } from "./types";

// ponytail: same defaults as sound.ts; keep inlined so Node tests don't need .ts specifiers
const DEFAULT_SOUNDS = { move: true, capture: true, check: true, end: true, volume: 0.7 };

export const DEFAULT_PROFILE: Profile = {
  name: "",
  plan: "free",
  puzzleRating: 1200,
  streak: 0,
  solved: 0,
  failed: 0,
  bestStreak: 0,
  theme: "default",
  sounds: DEFAULT_SOUNDS,
  analyses: [],
  lastAnalysisId: null,
  games: [],
  play: null,
  coach: null,
  openings: {},
  coordBest: 0,
  chessCom: "",
  lichess: "",
};

export function parseProfile(raw: unknown): Profile {
  const p = (raw && typeof raw === "object" ? raw : {}) as Partial<Profile>;
  return {
    ...DEFAULT_PROFILE,
    ...p,
    sounds: { ...DEFAULT_SOUNDS, ...p.sounds },
    analyses: Array.isArray(p.analyses) ? p.analyses : [],
    games: Array.isArray(p.games) ? p.games : [],
    play: p.play ?? null,
    coach: p.coach ?? null,
    openings: p.openings && typeof p.openings === "object" ? p.openings : {},
    coordBest: typeof p.coordBest === "number" ? p.coordBest : 0,
    chessCom: typeof p.chessCom === "string" ? p.chessCom.trim().toLowerCase().slice(0, 64) : "",
    lichess: typeof p.lichess === "string" ? p.lichess.trim().toLowerCase().slice(0, 64) : "",
  };
}

export function isFreshProfile(p: Profile): boolean {
  return (
    p.solved === 0 &&
    p.failed === 0 &&
    p.analyses.length === 0 &&
    p.games.length === 0 &&
    !p.play &&
    !p.coach &&
    p.puzzleRating === DEFAULT_PROFILE.puzzleRating &&
    p.coordBest === 0 &&
    !Object.keys(p.openings).length &&
    !p.chessCom &&
    !p.lichess
  );
}
