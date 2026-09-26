import assert from "node:assert/strict";
import {
  chessComGames,
  cloudEval,
  fetchDailyPuzzle,
  fetchPuzzle,
  lichessGames,
  openingName,
  resetCloudEval,
} from "./api.ts";

const now = new Date();
const ym = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

function json(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  };
}

export async function run(): Promise<void> {
(globalThis as { fetch: typeof fetch }).fetch = (async (input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes("/player/missing/games/archives")) return json(404, {});
  if (url.includes("/player/offline/games/archives")) return json(500, {});
  if (url.includes("/player/ana/games/archives")) {
    return json(200, { archives: [`https://api.chess.com/pub/player/ana/games/${ym}`] });
  }
  if (url.includes("/player/ana/games/")) {
    return json(200, {
      games: [
        { url: "https://www.chess.com/game/1", pgn: "1. e4 e5", time_class: "blitz", white: { username: "ana", result: "win" }, black: { username: "bob" } },
        { url: "https://www.chess.com/game/2", pgn: "1. d4 d5", white: { result: "stalemate" }, black: { username: "x", result: "stalemate" } },
        { url: "https://www.chess.com/game/3", pgn: "1. c4", black: { result: "win" } },
        { url: "https://www.chess.com/game/4", pgn: "1. Nf3" },
        { url: "https://www.chess.com/game/empty" },
      ],
    });
  }
  if (url.includes("/player/busy/games/archives")) return json(429, {});
  if (url.includes("lichess/games/user/missing")) return json(404, "");
  if (url.includes("lichess/games/user/down")) return json(503, "");
  if (url.includes("lichess/games/user/ana")) {
    return {
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () =>
        [
          JSON.stringify({ id: "ab", pgn: "1. e4", winner: "white", speed: "blitz", players: { white: { user: { name: "ana" } }, black: { user: { name: "bob" } } } }),
          JSON.stringify({ id: "cd", pgn: "1. d4", winner: "black" }),
          JSON.stringify({ id: "ef", pgn: "1. c4" }),
          JSON.stringify({ id: "skip" }),
          "",
        ].join("\n"),
    };
  }
  if (url.includes("/puzzle/next?angle=fork")) {
    return json(200, { game: { pgn: "1. e4" }, puzzle: { id: "p1", rating: 1400, solution: ["e2e4"], initialPly: 2, themes: ["fork"] } });
  }
  if (url.includes("/puzzle/next")) {
    return json(200, { game: { pgn: "1. e4" }, puzzle: { id: "p0", rating: 1200, solution: ["e2e4"], initialPly: 1 } });
  }
  if (url.includes("/puzzle/daily")) {
    return json(200, { game: { pgn: "1. d4" }, puzzle: { id: "d1", rating: 1500, solution: ["d2d4"], initialPly: 0, themes: ["mate"] } });
  }
  if (url.includes("cloud-eval") && url.includes("dead")) return Promise.reject(new TypeError("fetch failed"));
  if (url.includes("cloud-eval") && url.includes("empty")) return json(200, { depth: 12, pvs: [] });
  if (url.includes("cloud-eval") && url.includes("boom")) return json(500, {});
  if (url.includes("cloud-eval")) return json(200, { depth: 18, pvs: [{ moves: "e2e4", cp: 25 }, { moves: "d2d4", mate: 3 }] });
  if (url.includes("explorer") && url.includes("none")) return json(200, { opening: null });
  if (url.includes("explorer") && url.includes("bare")) return json(200, { opening: { name: "Start" } });
  if (url.includes("explorer") && url.includes("boom")) return json(500, {});
  if (url.includes("explorer")) return json(200, { opening: { eco: "C20", name: "King's Pawn" } });
  return json(500, {});
}) as typeof fetch;

  await assert.rejects(() => chessComGames("  "), /username/);
  await assert.rejects(() => chessComGames("missing"), /No Chess.com user/);
  await assert.rejects(() => chessComGames("offline"), /unreachable/);
  await assert.rejects(() => chessComGames("busy"), /Too many requests|unreachable/);
  const com = await chessComGames("Ana");
  assert.ok(com.some((g) => g.result === "1-0"));
  assert.ok(com.some((g) => g.result === "1/2-1/2"));
  assert.ok(com.some((g) => g.result === "0-1"));
  assert.ok(com.some((g) => g.result === "*"));
  assert.ok(com.every((g) => g.pgn));

  await assert.rejects(() => lichessGames(""), /username/);
  await assert.rejects(() => lichessGames("missing"), /No Lichess user/);
  await assert.rejects(() => lichessGames("down"), /Lichess error/);
  const li = await lichessGames("ana");
  assert.equal(li[0]?.result, "1-0");
  assert.equal(li[1]?.result, "0-1");
  assert.equal(li[2]?.result, "1/2-1/2");

  const p = await fetchPuzzle("fork");
  assert.equal(p.id, "p1");
  assert.equal((await fetchPuzzle()).id, "p0");
  assert.equal((await fetchDailyPuzzle()).id, "d1");

  const cloud = await cloudEval("start");
  assert.equal(cloud?.depth, 18);
  assert.equal(await cloudEval("empty"), null);
  assert.equal(await cloudEval("boom"), null);
  assert.equal(await cloudEval("dead"), null);
  assert.equal(await cloudEval("start"), null);
  resetCloudEval();
  assert.equal((await cloudEval("start"))?.depth, 18);
  assert.equal(await openingName("ok"), "C20 King's Pawn");
  assert.equal(await openingName("bare"), "Start");
  assert.equal(await openingName("none"), null);
  assert.equal(await openingName("boom"), null);
  console.log("api ok");
}
