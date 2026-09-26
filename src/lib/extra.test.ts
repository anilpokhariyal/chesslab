import assert from "node:assert/strict";
import { mean, faultCopy } from "./classify.ts";
import { skillScores, SKILL_LABEL } from "./dashboard.ts";
import { answer, botPlan, explainMove, sideCpl, summarize } from "./coach.ts";
import { jsonLd, meta, PassThrough, SITE, siteUrl } from "./seo.ts";
import { emailConfig, emailReady } from "./email-config.ts";
import { themeById, THEMES } from "./themes.ts";
import { OPENINGS } from "./openings.ts";
import { cloneGame, loadGame, outcome } from "./outcome.ts";
import { needsPromo } from "./promo.ts";
import { isFreshProfile, parseProfile } from "./profile.ts";
import { piecesIn, playSound, whichSound, DEFAULT_SOUNDS } from "./sound.ts";
import type { AnalyzedMove, SavedAnalysis } from "./types.ts";

assert.equal(mean([]), 0);
assert.equal(mean([2, 4, 6]), 4);
assert.match(faultCopy("e4", "d4", "mistake", 120, "", "").punish, /still looking/);
assert.match(faultCopy("e4", "d4", "mistake", 120, "Nf6", "").punish, /Nf6\.$/);

assert.deepEqual(skillScores([]), { opening: 50, tactics: 50, conversion: 50, endgame: 50, consistency: 50 });

const move = (over: Partial<AnalyzedMove>): AnalyzedMove => ({
  san: "e4",
  uci: "e2e4",
  fenBefore: "rnbqkbnr/pppppppp/8/8/8/8/PPPPKPPP/RNBQ1BNR w kq - 0 1",
  fenAfter: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPPKPPP/RNBQ1BNR b kq - 0 1",
  color: "w",
  cpl: 0,
  grade: "best",
  bestSan: "e4",
  bestUci: "e2e4",
  evalBefore: { type: "cp", value: 20 },
  evalAfter: { type: "cp", value: 20 },
  ...over,
});

const endFen = "8/8/8/8/8/2k5/2p5/2K5 w - - 0 1";
const analysis: SavedAnalysis = {
  id: "a1",
  at: 1,
  white: "W",
  black: "B",
  result: "1-0",
  pgn: "1. e4 e5",
  opening: "King's Pawn",
  whiteAccuracy: 90,
  blackAccuracy: 80,
  whiteAcpl: 20,
  blackAcpl: 40,
  moves: [
    move({ cpl: 5, grade: "best" }),
    move({ san: "e5", uci: "e7e5", color: "b", cpl: 10, grade: "good", evalBefore: { type: "cp", value: 200 }, evalAfter: { type: "cp", value: 190 } }),
    move({ san: "Qh5", grade: "blunder", cpl: 400, bestSan: "Nf3", fenBefore: endFen }),
    move({ san: "Nc6", color: "b", grade: "mistake", cpl: 150, bestSan: "g6" }),
  ],
};
const skills = skillScores([analysis]);
assert.ok(skills.opening > 0);
assert.ok(skills.tactics < 100);
assert.ok(skills.conversion > 0);
assert.ok(skills.endgame >= 0);
assert.equal(SKILL_LABEL.opening, "Opening");

assert.equal(sideCpl({ type: "cp", value: 50 }, { type: "cp", value: 10 }, "w"), 40);
assert.equal(sideCpl({ type: "cp", value: -50 }, { type: "cp", value: -10 }, "b"), 40);
assert.match(botPlan("e4", "e4", "develop"), /I played e4/);
assert.match(botPlan("Qh5", "Nf3", "take the pawn"), /prefers Nf3/);
assert.match(explainMove(analysis.moves[0], 1), /best move/);
assert.match(explainMove(analysis.moves[2], 3), /Best was Nf3/);
assert.ok(summarize(analysis).some((l) => /Opening/.test(l)));
const clean: SavedAnalysis = { ...analysis, opening: undefined, moves: [move({ cpl: 0 })] };
assert.ok(summarize(clean).some((l) => /Clean game/.test(l)));
assert.match(answer(analysis, "what about move 2"), /Black/);
assert.match(answer(analysis, "worst blunder"), /blunder/);
assert.match(answer(analysis, "black mistake"), /Black/);
assert.match(answer(analysis, "how was it"), /Accuracy/);

const prevUrl = process.env.APP_URL;
process.env.APP_URL = "https://example.com/";
assert.equal(siteUrl(), "https://example.com");
assert.equal(SITE.name, "ChessLab");
const m = meta({ title: "Play", description: "bots", path: "/play" });
assert.equal((m.title as { absolute: string }).absolute, "Play · ChessLab");
assert.deepEqual(m.robots, { index: true, follow: true });
const hidden = meta({ title: "Dash", description: "x", path: "/dashboard", index: false });
assert.deepEqual(hidden.robots, { index: false, follow: false });
assert.match(jsonLd(), /WebApplication/);
assert.equal(PassThrough({ children: "ok" }), "ok");
if (prevUrl === undefined) delete process.env.APP_URL;
else process.env.APP_URL = prevUrl;

const prevSmtp = {
  host: process.env.SMTP_HOST,
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS,
  from: process.env.SMTP_FROM,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE,
  name: process.env.SMTP_FROM_NAME,
};
process.env.SMTP_HOST = "smtp.example.com";
process.env.SMTP_USER = "u@x.com";
process.env.SMTP_PASS = "secret";
process.env.SMTP_FROM = "ChessLab <hello@x.com>";
process.env.SMTP_PORT = "465";
assert.equal(emailReady(), true);
assert.equal(emailConfig().secure, true);
assert.equal(emailConfig().from, "ChessLab <hello@x.com>");
process.env.SMTP_FROM = "hello@x.com";
process.env.SMTP_FROM_NAME = "Lab";
process.env.SMTP_PORT = "587";
delete process.env.SMTP_SECURE;
assert.equal(emailConfig().from, "Lab <hello@x.com>");
assert.equal(emailConfig().secure, false);
for (const [k, v] of Object.entries(prevSmtp)) {
  const key = (
    {
      host: "SMTP_HOST",
      user: "SMTP_USER",
      pass: "SMTP_PASS",
      from: "SMTP_FROM",
      port: "SMTP_PORT",
      secure: "SMTP_SECURE",
      name: "SMTP_FROM_NAME",
    } as const
  )[k as keyof typeof prevSmtp];
  if (v === undefined) delete process.env[key];
  else process.env[key] = v;
}

assert.equal(themeById("marble").premium, true);
assert.equal(themeById("nope").id, "default");
assert.ok(THEMES.length >= 4);
assert.ok(OPENINGS.some((o) => o.id === "sicilian"));

assert.equal(loadGame(undefined, "not-a-fen").fen().startsWith("rnbqkbnr"), true);
assert.equal(loadGame("not-pgn", "not-a-fen").fen().startsWith("rnbqkbnr"), true);
const start = loadGame();
assert.ok(cloneGame(start).fen() === start.fen());
assert.equal(outcome("not-a-fen"), null);
assert.equal(needsPromo("nope", "e2", "e4"), false);

assert.equal(parseProfile(null).name, "");
assert.equal(parseProfile({ openings: "x", coordBest: "1", chessCom: 1, lichess: 1, analyses: 1, games: 1 }).coordBest, 0);
assert.equal(isFreshProfile(parseProfile({ chessCom: "ana" })), false);
assert.equal(isFreshProfile(parseProfile({ play: { opp: "x", elo: 1, side: "w", fen: "", pgn: "", status: "" } })), false);

const e4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
const take = "rnbqkbnr/ppp1pppp/8/3P4/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2";
assert.equal(whichSound(e4, e4, DEFAULT_SOUNDS, null), null);
assert.equal(whichSound(e4, take, { ...DEFAULT_SOUNDS, capture: false }, null), "move");
assert.equal(whichSound(e4, take, { ...DEFAULT_SOUNDS, capture: false, move: false }, null), null);
assert.equal(whichSound(e4, take, { ...DEFAULT_SOUNDS, end: false }, { kind: "end" }), null);
assert.equal(whichSound(e4, take, DEFAULT_SOUNDS, { kind: "check" }), "check");
assert.equal(whichSound(e4, take, { ...DEFAULT_SOUNDS, check: false }, { kind: "check" }), "capture");
assert.equal(whichSound(e4, take, { ...DEFAULT_SOUNDS, check: false, capture: false, move: false }, { kind: "check" }), null);
assert.equal(piecesIn(e4), 32);
playSound("move", 0);

class FakeAudio {
  currentTime = 0;
  destination = {};
  resume() {
    return Promise.resolve();
  }
  createOscillator() {
    return {
      type: "triangle",
      frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect() {
        return { connect() {} };
      },
      start() {},
      stop() {},
    };
  }
  createGain() {
    return {
      gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect() {
        return { connect() {} };
      },
    };
  }
}
(globalThis as { AudioContext?: unknown }).AudioContext = FakeAudio;
(globalThis as { window?: unknown }).window ??= { AudioContext: FakeAudio };
playSound("capture", 0.5);
playSound("check", 0.2);
playSound("end", 0.1);

console.log("extra ok");
