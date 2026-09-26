export type PlatformGame = {
  id: string;
  white: string;
  black: string;
  result: string;
  pgn: string;
  time?: string;
};

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(res.status === 429 ? "Too many requests. Wait a moment and try again." : `${res.status} ${url}`);
  return res.json();
}

type ChessComGame = {
  url: string;
  pgn?: string;
  time_class?: string;
  white?: { username?: string; result?: string };
  black?: { username?: string; result?: string };
};

function mapChessCom(g: ChessComGame): PlatformGame {
  return {
    id: g.url,
    white: g.white?.username ?? "White",
    black: g.black?.username ?? "Black",
    result: resultFromPair(g.white?.result, g.black?.result),
    pgn: g.pgn!,
    time: g.time_class,
  };
}

export async function chessComGames(username: string): Promise<PlatformGame[]> {
  const u = username.trim().toLowerCase();
  if (!u) throw new Error("Enter a username.");
  let listed: string[] = [];
  try {
    const archives = (await getJson(
      `/api/chesscom/player/${encodeURIComponent(u)}/games/archives`,
    )) as { archives?: string[] };
    listed = archives.archives ?? [];
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.startsWith("404")) throw new Error(`No Chess.com user “${u}”`);
    throw new Error("Chess.com is unreachable. Try again.");
  }
  const now = new Date();
  const current = `https://api.chess.com/pub/player/${u}/games/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  // ponytail: 12 months / 20 games; walk more archives if recent months stay empty
  const urls = [current, ...[...listed].reverse()].filter((url, i, a) => a.indexOf(url) === i).slice(0, 12);
  const out: PlatformGame[] = [];
  for (const url of urls) {
    if (out.length >= 20) break;
    const path = url.replace("https://api.chess.com/pub/", "");
    try {
      const month = (await getJson(`/api/chesscom/${path}`)) as { games?: ChessComGame[] };
      out.push(...(month.games ?? []).filter((g) => g.pgn).reverse().map(mapChessCom));
    } catch {
      /* month not published yet */
    }
  }
  return out.slice(0, 20);
}

function resultFromPair(w?: string, b?: string): string {
  if (w === "win") return "1-0";
  if (b === "win") return "0-1";
  if (w === "stalemate" || w === "agreed" || w === "repetition" || w === "insufficient") return "1/2-1/2";
  return "*";
}

export async function lichessGames(username: string): Promise<PlatformGame[]> {
  const u = username.trim().toLowerCase();
  if (!u) throw new Error("Enter a username.");
  const res = await fetch(
    `/api/lichess/games/user/${encodeURIComponent(u)}?max=20&pgnInJson=true&moves=true`,
    { headers: { Accept: "application/x-ndjson" } },
  );
  if (res.status === 404) throw new Error(`No Lichess user “${u}”`);
  if (!res.ok) throw new Error(`Lichess error ${res.status}`);
  const text = await res.text();
  return text
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const g = JSON.parse(line) as {
        id: string;
        pgn?: string;
        winner?: string;
        speed?: string;
        players?: { white?: { user?: { name?: string } }; black?: { user?: { name?: string } } };
      };
      return {
        id: g.id,
        white: g.players?.white?.user?.name ?? "White",
        black: g.players?.black?.user?.name ?? "Black",
        result: g.winner === "white" ? "1-0" : g.winner === "black" ? "0-1" : "1/2-1/2",
        pgn: g.pgn ?? "",
        time: g.speed,
      };
    })
    .filter((g) => g.pgn);
}

export type LichessPuzzle = {
  id: string;
  rating: number;
  solution: string[];
  initialPly: number;
  pgn: string;
  themes?: string[];
};

export async function fetchPuzzle(angle?: string): Promise<LichessPuzzle> {
  const q = angle ? `?angle=${encodeURIComponent(angle)}` : "";
  const data = (await getJson(`/api/lichess/puzzle/next${q}`)) as {
    game: { pgn: string };
    puzzle: { id: string; rating: number; solution: string[]; initialPly: number; themes?: string[] };
  };
  return {
    id: data.puzzle.id,
    rating: data.puzzle.rating,
    solution: data.puzzle.solution,
    initialPly: data.puzzle.initialPly,
    pgn: data.game.pgn,
    themes: data.puzzle.themes,
  };
}

export async function fetchDailyPuzzle(): Promise<LichessPuzzle> {
  const data = (await getJson("/api/lichess/puzzle/daily")) as {
    game: { pgn: string };
    puzzle: { id: string; rating: number; solution: string[]; initialPly: number; themes?: string[] };
  };
  return {
    id: data.puzzle.id,
    rating: data.puzzle.rating,
    solution: data.puzzle.solution,
    initialPly: data.puzzle.initialPly,
    pgn: data.game.pgn,
    themes: data.puzzle.themes,
  };
}

export async function cloudEval(fen: string): Promise<{
  depth: number;
  pvs: { moves: string; cp?: number; mate?: number }[];
} | null> {
  try {
    const data = (await getJson(`/api/lichess/cloud-eval?fen=${encodeURIComponent(fen)}&multiPv=3`)) as {
      depth?: number;
      pvs?: { moves: string; cp?: number; mate?: number }[];
    };
    if (!data.pvs?.length) return null;
    return { depth: data.depth ?? 0, pvs: data.pvs };
  } catch {
    return null;
  }
}

export async function openingName(fen: string): Promise<string | null> {
  try {
    const data = (await getJson(`/api/explorer?fen=${encodeURIComponent(fen)}`)) as {
      opening?: { name?: string; eco?: string } | null;
    };
    if (!data.opening?.name) return null;
    return data.opening.eco ? `${data.opening.eco} ${data.opening.name}` : data.opening.name;
  } catch {
    return null;
  }
}
