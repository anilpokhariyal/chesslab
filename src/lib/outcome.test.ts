import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { outcome } from "./outcome.ts";

assert.equal(outcome("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"), null);
assert.equal(outcome("rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3")?.text, "Checkmate");
assert.equal(outcome("k7/8/1Q6/8/8/8/8/K7 b - - 0 1")?.text, "Stalemate");
assert.equal(outcome("4k3/8/4Q3/8/8/8/8/4K3 b - - 0 1")?.text, "Check");

const rep = new Chess();
rep.loadPgn("1. Nf3 Nf6 2. Ng1 Ng8 3. Nf3 Nf6 4. Ng1 Ng8");
assert.equal(outcome(rep.fen())?.text, undefined);
assert.equal(outcome(rep.fen(), rep.pgn())?.text, "Draw by repetition");
assert.equal(rep.isGameOver(), true);

const mate = new Chess();
mate.loadPgn("1. f3 e5 2. g4 Qh4#");
assert.equal(outcome(new Chess().fen(), mate.pgn()), null);
assert.equal(outcome(mate.history({ verbose: true })[1].after, mate.pgn()), null);
assert.equal(outcome("4k3/8/4Q3/8/8/8/8/4K3 b - - 0 1", mate.pgn())?.text, "Check");
assert.equal(outcome(mate.fen(), mate.pgn())?.text, "Checkmate");

console.log("outcome ok");
