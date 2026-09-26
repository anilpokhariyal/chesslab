import assert from "node:assert/strict";
import { needsPromo } from "./promo.ts";

assert.equal(needsPromo("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "e2", "e4"), false);
assert.equal(needsPromo("k7/4P3/8/8/8/8/8/K7 w - - 0 1", "e7", "e8"), true);
assert.equal(needsPromo("k7/8/8/8/8/8/4p3/K7 b - - 0 1", "e2", "e1"), true);
console.log("promo ok");
