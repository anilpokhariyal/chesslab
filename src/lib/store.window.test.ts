import assert from "node:assert/strict";
import { DEFAULT_PROFILE } from "./profile.ts";

const mem: Record<string, string> = {};
const listeners: Record<string, Set<() => void>> = {};
const ls = {
  getItem: (k: string) => (k in mem ? mem[k] : null),
  setItem: (k: string, v: string) => {
    mem[k] = v;
  },
  removeItem: (k: string) => {
    delete mem[k];
  },
};
const win = {
  localStorage: ls,
  addEventListener(type: string, cb: () => void) {
    (listeners[type] ??= new Set()).add(cb);
  },
  removeEventListener(type: string, cb: () => void) {
    listeners[type]?.delete(cb);
  },
  dispatchEvent(e: { type: string }) {
    listeners[e.type]?.forEach((cb) => cb());
    return true;
  },
};
Object.assign(globalThis, { window: win, localStorage: ls });

export async function run(): Promise<void> {
  const {
    canUseTheme,
    depthFor,
    hydrateCloud,
    loadProfile,
    patchProfile,
    recordGame,
    rememberDraft,
    saveAnalysis,
    saveProfile,
    setCloudSync,
    updateRating,
  } = await import("./store.ts");

  assert.equal(depthFor("free"), 12);
  assert.equal(depthFor("coach"), 25);
  assert.equal(canUseTheme("free", "default"), true);
  assert.equal(canUseTheme("free", "marble"), false);
  assert.equal(canUseTheme("premium", "marble"), true);
  assert.ok(updateRating(1200, 1200, true) > 1200);
  assert.ok(updateRating(1200, 1200, false) < 1200);

  const empty = loadProfile();
  assert.equal(empty.puzzleRating, 1200);
  mem["chesslab-profile"] = "{not-json";
  assert.equal(loadProfile().name, "");
  saveProfile({ ...DEFAULT_PROFILE, name: "Local" });
  assert.equal(loadProfile().name, "Local");
  patchProfile((p) => ({ ...p, streak: 3 }));
  assert.equal(loadProfile().streak, 3);
  rememberDraft("play", {
    opp: "Easy",
    elo: 800,
    side: "w",
    fen: "start",
    pgn: "1. e4",
    status: "in progress",
  });
  assert.equal(loadProfile().play?.opp, "Easy");
  recordGame({ id: "g1", at: 1, kind: "play", pgn: "1. e4 e5", result: "1-0", opp: "Easy" });
  assert.equal(loadProfile().play, null);
  assert.equal(loadProfile().games[0]?.id, "g1");
  saveAnalysis({
    id: "an1",
    at: 1,
    white: "W",
    black: "B",
    result: "*",
    pgn: "1. e4",
    moves: [],
    whiteAccuracy: 90,
    blackAccuracy: 90,
    whiteAcpl: 10,
    blackAcpl: 10,
  });
  assert.equal(loadProfile().lastAnalysisId, "an1");

  let puts = 0;
  (globalThis as { fetch: typeof fetch }).fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === "PUT") {
      puts += 1;
      return { ok: true, status: 200, json: async () => ({}) };
    }
    const url = String(input);
    if (url.includes("/api/me") && mem.__fresh === "1") {
      return { ok: true, status: 200, json: async () => ({ name: "Server" }) };
    }
    if (url.includes("/api/me") && mem.__fresh === "fail") {
      return { ok: false, status: 401, json: async () => ({}) };
    }
    return { ok: true, status: 200, json: async () => ({ name: "Cloud", games: [{ id: "x", at: 1, kind: "play", pgn: "", result: "1-0", opp: "A" }] }) };
  }) as typeof fetch;

  setCloudSync(true);
  saveProfile(loadProfile());
  await new Promise((r) => setTimeout(r, 450));
  assert.ok(puts >= 1);

  mem.__fresh = "fail";
  await hydrateCloud();
  mem.__fresh = "1";
  await hydrateCloud();
  assert.equal(loadProfile().name, "Local");
  delete mem.__fresh;
  await hydrateCloud();
  assert.equal(loadProfile().name, "Cloud");
  setCloudSync(false);
  console.log("store.window ok");
}
