import { Chess } from "chess.js";
import type { PositionEval, PvLine, Score } from "./types";

const SCRIPT = "/stockfish/stockfish-19-lite-single.js";

type Job = {
  cmds: string[];
  done: (line: string) => boolean;
  resolve: (lines: string[]) => void;
  reject: (err: Error) => void;
  lines: string[];
};

class Stockfish {
  private worker: Worker | null = null;
  private jobs: Job[] = [];
  private current: Job | null = null;
  private boot: Promise<void> | null = null;

  private ensure(): Promise<void> {
    if (this.boot) return this.boot;
    this.boot = new Promise((resolve, reject) => {
      const w = new Worker(SCRIPT);
      this.worker = w;
      w.onerror = (e) => reject(new Error(String(e.message || "stockfish worker")));
      w.onmessage = (e) => {
        const line = String(e.data);
        if (!this.current) {
          if (line === "uciok" || line === "readyok") return;
          return;
        }
        this.current.lines.push(line);
        if (this.current.done(line)) {
          const job = this.current;
          this.current = null;
          job.resolve(job.lines);
          this.pump();
        }
      };
      w.postMessage("uci");
      const waitUci = (ev: MessageEvent) => {
        if (String(ev.data) === "uciok") {
          w.removeEventListener("message", waitUci);
          w.postMessage("isready");
        }
      };
      const waitReady = (ev: MessageEvent) => {
        if (String(ev.data) === "readyok") {
          w.removeEventListener("message", waitReady);
          resolve();
        }
      };
      w.addEventListener("message", waitUci);
      w.addEventListener("message", waitReady);
    });
    return this.boot;
  }

  private pump() {
    if (this.current || !this.jobs.length || !this.worker) return;
    this.current = this.jobs.shift()!;
    for (const c of this.current.cmds) this.worker.postMessage(c);
  }

  private run(cmds: string[], done: (line: string) => boolean): Promise<string[]> {
    return new Promise((resolve, reject) => {
      this.jobs.push({ cmds, done, resolve, reject, lines: [] });
      this.pump();
    });
  }

  async analyze(fen: string, depth: number, multiPv = 3): Promise<PositionEval> {
    await this.ensure();
    const lines = await this.run(
      [
        "setoption name UCI_LimitStrength value false",
        `setoption name MultiPV value ${multiPv}`,
        `position fen ${fen}`,
        `go depth ${depth}`,
      ],
      (l) => l.startsWith("bestmove"),
    );
    return parseInfo(fen, lines);
  }

  stop() {
    this.worker?.postMessage("stop");
  }

  async bestMove(fen: string, opts?: { elo?: number; movetime?: number; depth?: number }): Promise<string> {
    await this.ensure();
    const cmds = opts?.elo
      ? [
          "setoption name UCI_LimitStrength value true",
          `setoption name UCI_Elo value ${opts.elo}`,
        ]
      : ["setoption name UCI_LimitStrength value false"];
    cmds.push("setoption name MultiPV value 1", `position fen ${fen}`);
    cmds.push(opts?.movetime ? `go movetime ${opts.movetime}` : `go depth ${opts?.depth ?? 10}`);
    const lines = await this.run(cmds, (l) => l.startsWith("bestmove"));
    const last = [...lines].reverse().find((l) => l.startsWith("bestmove")) ?? "";
    return normalizeUci(last.split(/\s+/)[1] ?? "");
  }
}

function parseScore(parts: string[], i: number, turn: "w" | "b"): Score {
  const kind = parts[i + 1];
  const n = Number(parts[i + 2]);
  const sign = turn === "w" ? 1 : -1;
  if (kind === "mate") return { type: "mate", value: sign * n };
  return { type: "cp", value: sign * n };
}

function parseInfo(fen: string, lines: string[]): PositionEval {
  const turn = fen.split(" ")[1] === "b" ? "b" : "w";
  const byPv = new Map<number, PvLine>();
  let bestMove = "";
  for (const line of lines) {
    if (line.startsWith("bestmove")) {
      bestMove = normalizeUci(line.split(/\s+/)[1] ?? bestMove);
      continue;
    }
    if (!line.startsWith("info ") || !line.includes(" pv ")) continue;
    const parts = line.split(/\s+/);
    const mp = parts.indexOf("multipv");
    const sc = parts.indexOf("score");
    const pv = parts.indexOf("pv");
    if (sc < 0 || pv < 0) continue;
    const idx = mp >= 0 ? Number(parts[mp + 1]) : 1;
    byPv.set(idx, { score: parseScore(parts, sc, turn), moves: parts.slice(pv + 1).map(normalizeUci) });
  }
  const pvs = [...byPv.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
  const score = pvs[0]?.score ?? { type: "cp", value: 0 };
  if (!bestMove) bestMove = pvs[0]?.moves[0] ?? "";
  return { fen, bestMove, score, pvs };
}

export function scoreToWhiteCp(s: Score): number {
  if (s.type === "mate") return s.value > 0 ? 10000 - s.value : -10000 - s.value;
  return s.value;
}

export function formatScore(s: Score): string {
  if (s.type === "mate") return `M${s.value}`;
  const v = s.value / 100;
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}`;
}

/** Stockfish lite sometimes emits chess960 castling (king to rook square). */
export function normalizeUci(uci: string): string {
  const map: Record<string, string> = { e1h1: "e1g1", e1a1: "e1c1", e8h8: "e8g8", e8a8: "e8c8" };
  const core = uci.slice(0, 4);
  return map[core] ? map[core] + uci.slice(4) : uci;
}

export function pvToSan(fen: string, ucis: string[]): string {
  let g: Chess;
  try {
    g = new Chess(fen);
  } catch {
    return ucis.slice(0, 8).join(" ");
  }
  const out: string[] = [];
  for (const raw of ucis.slice(0, 8)) {
    const u = normalizeUci(raw);
    try {
      const m = g.move({
        from: u.slice(0, 2),
        to: u.slice(2, 4),
        promotion: u[4] as "q" | "r" | "b" | "n" | undefined,
      });
      if (!m) break;
      out.push(m.san);
    } catch {
      break;
    }
  }
  return out.join(" ");
}

export function uciToSan(fen: string, uci: string): string {
  if (!uci || uci === "(none)") return "";
  const u = normalizeUci(uci);
  try {
    const g = new Chess(fen);
    const move = g.move({
      from: u.slice(0, 2),
      to: u.slice(2, 4),
      promotion: u[4] as "q" | "r" | "b" | "n" | undefined,
    });
    return move?.san ?? uci;
  } catch {
    return uci;
  }
}

export function isCaptureSacrifice(fen: string, uci: string): boolean {
  try {
    const g = new Chess(fen);
    const u = normalizeUci(uci);
    const move = g.move({
      from: u.slice(0, 2),
      to: u.slice(2, 4),
      promotion: u[4] as "q" | "r" | "b" | "n" | undefined,
    });
    if (!move?.captured) return false;
    const val: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    return (val[move.piece] ?? 0) > (val[move.captured] ?? 0);
  } catch {
    return false;
  }
}

let singleton: Stockfish | null = null;
export function getEngine(): Stockfish {
  if (!singleton) singleton = new Stockfish();
  return singleton;
}
