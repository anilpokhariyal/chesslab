"use client";

import { Chess } from "chess.js";
import { useEffect, useState } from "react";
import { Board } from "@/components/Board";
import { getEngine, normalizeUci } from "@/lib/engine";
import { cloneGame, loadGame, outcome } from "@/lib/outcome";
import { recordGame, rememberDraft, useProfile } from "@/lib/store";

const BOTS = [
  { name: "Pawn Pusher", elo: 600 },
  { name: "Coffeehouse Carl", elo: 800 },
  { name: "Club Newbie", elo: 1000 },
  { name: "Weekend Warrior", elo: 1200 },
  { name: "Tactics Tina", elo: 1400 },
  { name: "Club Regular", elo: 1600 },
  { name: "Tournament Tom", elo: 1800 },
  { name: "The Candidate", elo: 2100 },
  { name: "The Machine Whisperer", elo: 2400 },
  { name: "Stockfish", elo: 3000 },
];


export default function Page() {
  const profile = useProfile();
  const [bot, setBot] = useState<(typeof BOTS)[number] | null>(null);
  const [game, setGame] = useState(() => new Chess());
  const [fen, setFen] = useState(game.fen());
  const [side, setSide] = useState<"w" | "b">("w");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Pick a bot.");

  useEffect(() => {
    if (bot || !profile.play) return;
    const d = profile.play;
    const g = loadGame(d.pgn, d.fen);
    setBot(BOTS.find((b) => b.name === d.opp) ?? { name: d.opp, elo: d.elo });
    setSide(d.side);
    setGame(g);
    setFen(g.fen());
    setStatus(d.status);
  }, [bot, profile.play]);

  const persist = (b: (typeof BOTS)[number], playAs: "w" | "b", g: Chess, text: string) => {
    if (g.isGameOver()) {
      recordGame({
        id: crypto.randomUUID(),
        at: Date.now(),
        kind: "play",
        pgn: g.pgn(),
        result: text,
        opp: b.name,
      });
      return;
    }
    rememberDraft("play", { opp: b.name, elo: b.elo, side: playAs, fen: g.fen(), pgn: g.pgn(), status: text });
  };

  const engineMove = async (b: (typeof BOTS)[number], playAs: "w" | "b", g: Chess) => {
    setBusy(true);
    const uci = await getEngine().bestMove(g.fen(), {
      elo: b.elo >= 3000 ? undefined : b.elo,
      movetime: 400,
    });
    if (uci && uci !== "(none)") {
      const u = normalizeUci(uci);
      g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: (u[4] as "q") || "q" });
    }
    setFen(g.fen());
    setGame(cloneGame(g));
    setBusy(false);
    const o = outcome(g.fen(), g.pgn());
    const text = o?.text ?? `vs ${b.name}`;
    if (o) setStatus(text);
    persist(b, playAs, g, text);
  };

  const start = async (b: (typeof BOTS)[number], playAs: "w" | "b") => {
    const g = new Chess();
    setBot(b);
    setSide(playAs);
    setGame(g);
    setFen(g.fen());
    setStatus(`vs ${b.name}`);
    persist(b, playAs, g, `vs ${b.name}`);
    if (playAs === "b") await engineMove(b, playAs, g);
  };

  const onDrop = (from: string, to: string, promotion?: "q" | "r" | "b" | "n") => {
    if (!bot || busy) return false;
    if (game.turn() !== side) return false;
    const g = cloneGame(game);
    try {
      if (!g.move({ from, to, promotion: promotion ?? "q" })) return false;
    } catch {
      return false;
    }
    setFen(g.fen());
    setGame(cloneGame(g));
    const o = outcome(g.fen(), g.pgn());
    const text = o?.text ?? `vs ${bot.name}`;
    if (o) setStatus(text);
    persist(bot, side, g, text);
    if (g.isGameOver()) return true;
    engineMove(bot, side, g);
    return true;
  };

  return (
    <>
      <h1 className="page-title">Play vs bots</h1>
      <p className="lede">
        Stockfish limited to a rating. Human-like Maia nets are the upgrade if you want real amateur mistakes.
      </p>
      {!bot ? (
        <div className="cards">
          {BOTS.map((b) => (
            <div key={b.name} className="card">
              <h3>{b.name}</h3>
              <p className="muted">rated {b.elo}</p>
              <div className="row">
                <button className="btn btn-primary" onClick={() => start(b, "w")}>
                  White
                </button>
                <button className="btn" onClick={() => start(b, "b")}>
                  Black
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="row" style={{ marginBottom: 8 }}>
            <button
              className="btn"
              onClick={() => {
                rememberDraft("play", null);
                setBot(null);
              }}
            >
              Change bot
            </button>
            <span>{status}</span>
            {busy && <span className="muted">thinking…</span>}
          </div>
          <Board fen={fen} pgn={game.pgn()} flipped={side === "b"} onDrop={onDrop} allowDrag={!busy} announce />
        </>
      )}
    </>
  );
}
