import { useSyncExternalStore } from "react";
import { DEFAULT_PROFILE, isFreshProfile, parseProfile } from "./profile";
import { themeById } from "./themes";
import type { GameDraft, Plan, PlayedGame, Profile, SavedAnalysis } from "./types";

export { DEFAULT_PROFILE, isFreshProfile, parseProfile };

const KEY = "chesslab-profile";

function readLocal(raw: string): Profile {
  try {
    return parseProfile(JSON.parse(raw) as unknown);
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

export function loadProfile(): Profile {
  if (typeof window === "undefined") return { ...DEFAULT_PROFILE };
  const raw = localStorage.getItem(KEY);
  return raw ? readLocal(raw) : { ...DEFAULT_PROFILE };
}

function writeLocal(p: Profile): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(p));
  window.dispatchEvent(new Event("chesslab-profile"));
}

let cloud = false;
let timer: ReturnType<typeof setTimeout> | null = null;

export function setCloudSync(on: boolean): void {
  cloud = on;
}

function pushCloud(p: Profile): void {
  if (!cloud || typeof window === "undefined") return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    void fetch("/api/me", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(p),
    });
  }, 400);
}

export function saveProfile(p: Profile): void {
  writeLocal(p);
  pushCloud(p);
}

export function patchProfile(fn: (p: Profile) => Profile): Profile {
  const next = fn(loadProfile());
  saveProfile(next);
  return next;
}

export async function hydrateCloud(): Promise<void> {
  const res = await fetch("/api/me");
  if (!res.ok) return;
  const server = parseProfile(await res.json());
  const local = loadProfile();
  if (isFreshProfile(server) && !isFreshProfile(local)) {
    writeLocal({ ...local, name: local.name || server.name });
    pushCloud(loadProfile());
    return;
  }
  writeLocal({ ...server, name: server.name || local.name });
}

export function rememberDraft(kind: "play" | "coach", draft: GameDraft | null): void {
  patchProfile((p) => ({ ...p, [kind]: draft }));
}

export function recordGame(g: PlayedGame): void {
  patchProfile((p) => ({
    ...p,
    [g.kind]: null,
    games: [g, ...p.games.filter((x) => x.id !== g.id)].slice(0, 40),
  }));
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
  return readLocal(raw);
}

export function updateRating(rating: number, puzzleRating: number, win: boolean): number {
  const expected = 1 / (1 + 10 ** ((puzzleRating - rating) / 400));
  return Math.round(rating + 32 * ((win ? 1 : 0) - expected));
}
