import { useSyncExternalStore } from "react";
import { DEFAULT_SOUNDS } from "./sound";
import { themeById } from "./themes";
import type { Plan, Profile, SavedAnalysis } from "./types";

const KEY = "chesslab-profile";

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
};

function readProfile(raw: string): Profile {
  try {
    const p = JSON.parse(raw) as Partial<Profile>;
    return { ...DEFAULT_PROFILE, ...p, sounds: { ...DEFAULT_SOUNDS, ...p.sounds } };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

export function loadProfile(): Profile {
  if (typeof window === "undefined") return DEFAULT_PROFILE;
  const raw = localStorage.getItem(KEY);
  return raw ? readProfile(raw) : { ...DEFAULT_PROFILE };
}

export function saveProfile(p: Profile): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(p));
  window.dispatchEvent(new Event("chesslab-profile"));
}

export function patchProfile(fn: (p: Profile) => Profile): Profile {
  const next = fn(loadProfile());
  saveProfile(next);
  return next;
}

export function depthFor(plan: Plan): number {
  return plan === "free" ? 12 : 25;
}

export function canUseTheme(plan: Plan, theme: string): boolean {
  return !themeById(theme).premium || plan !== "free";
}

export function saveAnalysis(a: SavedAnalysis): Profile {
  return patchProfile((p) => ({
    ...p,
    lastAnalysisId: a.id,
    analyses: [a, ...p.analyses.filter((x) => x.id !== a.id)].slice(0, 40),
  }));
}

export function useProfile(): Profile {
  const raw = useSyncExternalStore(
    (cb) => {
      window.addEventListener("storage", cb);
      window.addEventListener("chesslab-profile", cb);
      return () => {
        window.removeEventListener("storage", cb);
        window.removeEventListener("chesslab-profile", cb);
      };
    },
    () => localStorage.getItem(KEY) ?? "",
    () => "",
  );
  if (!raw) return DEFAULT_PROFILE;
  return readProfile(raw);
}

export function updateRating(rating: number, puzzleRating: number, win: boolean): number {
  const expected = 1 / (1 + 10 ** ((puzzleRating - rating) / 400));
  return Math.round(rating + 32 * ((win ? 1 : 0) - expected));
}
