import assert from "node:assert/strict";
import { outcome } from "./outcome.ts";

assert.equal(outcome("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"), null);
assert.equal(outcome("rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3")?.text, "Checkmate");
assert.equal(outcome("k7/8/1Q6/8/8/8/8/K7 b - - 0 1")?.text, "Stalemate");
assert.equal(outcome("4k3/8/4Q3/8/8/8/8/4K3 b - - 0 1")?.text, "Check");
console.log("outcome ok");
