import assert from "node:assert/strict";
import { createUser } from "./auth.ts";
import { loadAccount, saveAccount } from "./persist.ts";
import { prisma, ready } from "./prisma.ts";
import { DEFAULT_PROFILE } from "./profile.ts";
import type { AnalyzedMove, SavedAnalysis } from "./types.ts";

export async function run(): Promise<void> {
const client = await ready();
assert.equal(client, prisma);

const stamp = `${Date.now()}${Math.random().toString(16).slice(2, 8)}`;
const u = await createUser(`Persist ${stamp}`, `persist-${stamp}@example.com`, "password1");

await assert.rejects(() => loadAccount("missing-user"), /Not signed in/);
await assert.rejects(() => saveAccount("missing-user", DEFAULT_PROFILE), /Not signed in/);

const start = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const move: AnalyzedMove = {
  san: "e4",
  uci: "e2e4",
  fenBefore: start,
  fenAfter: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
  color: "w",
  cpl: 5,
  grade: "best",
  bestSan: "e4",
  bestUci: "e2e4",
  evalBefore: { type: "cp", value: 20 },
  evalAfter: { type: "cp", value: 25 },
};

const draftPlay = {
  opp: "Easy Bot",
  elo: 800,
  side: "b" as const,
  fen: start,
  pgn: "1. e4",
  status: "in progress",
  mode: "play" as const,
  log: [
    { who: "you" as const, text: "hello" },
    { who: "bot" as const, text: "hi" },
    { who: "sys" as const, text: "ok" },
    { who: "nope" as unknown as "you", text: "x" },
  ],
};
const draftCoach = {
  opp: "Coach",
  elo: 1400,
  side: "w" as const,
  fen: start,
  pgn: "",
  status: "in progress",
  mode: "full" as const,
};

const analysis: SavedAnalysis = {
  id: `an-${stamp}`,
  at: Date.now(),
  white: "White",
  black: "Black",
  result: "1-0",
  pgn: "1. e4 e5",
  opening: "King's Pawn",
  moves: [move],
  whiteAccuracy: 95,
  blackAccuracy: 90,
  whiteAcpl: 8,
  blackAcpl: 12,
};

const first = await saveAccount(u.id, {
  ...DEFAULT_PROFILE,
  name: "Renamed",
  plan: "premium",
  puzzleRating: 1300,
  streak: 2,
  solved: 3,
  failed: 1,
  bestStreak: 4,
  theme: "wooden",
  coordBest: 12,
  lastAnalysisId: analysis.id,
  openings: { london: { ch: 0, ply: 2 } },
  chessCom: "Maya",
  lichess: "MayaL",
  play: draftPlay,
  coach: draftCoach,
  games: [
    { id: `gp-${stamp}`, at: Date.now(), kind: "play", pgn: "1. e4 e5", result: "1-0", opp: "Easy" },
    { id: `gc-${stamp}`, at: Date.now() - 1, kind: "coach", pgn: "1. d4", result: "0-1", opp: "Coach" },
  ],
  analyses: [analysis],
});
assert.equal(first.name, "Renamed");
assert.equal(first.plan, "premium");
assert.equal(first.play?.side, "b");
assert.equal(first.play?.log?.length, 4);
assert.equal(first.play?.log?.[3]?.who, "you");
assert.equal(first.coach?.mode, "full");
assert.equal(first.games.length, 2);
assert.equal(first.analyses[0]?.moves[0]?.san, "e4");
assert.equal(first.chessCom, "maya");

const again = await saveAccount(u.id, {
  ...first,
  plan: "coach",
  play: { ...draftPlay, mode: "basics", log: [] },
  coach: { ...draftCoach, mode: undefined },
  analyses: [{ ...analysis, opening: undefined, moves: [] }],
});
assert.equal(again.plan, "coach");
assert.equal(again.play?.mode, "basics");
assert.equal(again.analyses[0]?.moves.length, 0);

const dropped = await saveAccount(u.id, { ...again, play: null, coach: null });
assert.equal(dropped.play, null);
assert.equal(dropped.coach, null);

const games = Array.from({ length: 41 }, (_, i) => ({
  id: `gx${i}-${stamp}`.slice(0, 40),
  at: Date.now() - i,
  kind: (i === 1 ? "coach" : "play") as "play" | "coach",
  pgn: "1. e4",
  result: "1-0",
  opp: "Cap",
}));
const analyses = Array.from({ length: 41 }, (_, i) => ({
  ...analysis,
  id: `ax${i}-${stamp}`.slice(0, 40),
  at: Date.now() - i,
  opening: undefined,
  moves: [],
}));
const capped = await saveAccount(u.id, { ...dropped, games, analyses, plan: "free" });
assert.ok(capped.games.length <= 40);
assert.ok(capped.analyses.length <= 40);
assert.equal(capped.plan, "free");

const bareId = `bare-${stamp}`;
await prisma.user.create({
  data: {
    id: bareId,
    name: "Bare",
    email: `bare-${stamp}@example.com`,
    pass: "x",
    created: BigInt(Date.now()),
    verified: false,
  },
});
const bare = await loadAccount(bareId);
assert.equal(bare.plan, "free");
assert.equal(bare.games.length, 0);

console.log("persist ok");
}
