import assert from "node:assert/strict";
import { DEFAULT_PROFILE, isFreshProfile, parseProfile } from "./profile.ts";

assert.equal(isFreshProfile(DEFAULT_PROFILE), true);
assert.equal(isFreshProfile({ ...DEFAULT_PROFILE, solved: 1 }), false);

const p = parseProfile({ name: "Ana", games: [{ id: "1", at: 1, kind: "play", pgn: "", result: "1-0", opp: "Easy" }] });
assert.equal(p.name, "Ana");
assert.equal(p.games.length, 1);
assert.equal(p.play, null);
assert.equal(p.puzzleRating, 1200);
assert.equal(parseProfile({ chessCom: " Ana " }).chessCom, "ana");
assert.equal(parseProfile({}).lichess, "");

console.log("store ok");
