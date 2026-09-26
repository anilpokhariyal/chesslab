import assert from "node:assert/strict";
import { DEFAULT_SOUNDS, piecesIn, whichSound } from "./sound.ts";

const start = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const e4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
const take = "rnbqkbnr/ppp1pppp/8/3P4/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2";
const mate = "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3";
assert.equal(piecesIn(start), 32);
assert.equal(whichSound(start, e4, DEFAULT_SOUNDS, null), "move");
assert.equal(whichSound(e4, take, DEFAULT_SOUNDS, null), "capture");
assert.equal(whichSound(start, mate, DEFAULT_SOUNDS, { kind: "end" }), "end");
assert.equal(whichSound(start, e4, { ...DEFAULT_SOUNDS, move: false }, null), null);
console.log("sound ok");
