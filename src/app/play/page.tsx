"use client";

import { Chess } from "chess.js";
import { useState } from "react";
import { Board } from "@/components/Board";
import { getEngine, normalizeUci } from "@/lib/engine";
import { outcome } from "@/lib/outcome";

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
  const [bot, setBot] = useState<(typeof BOTS)[number] | null>(null);
  const [game, setGame] = useState(() => new Chess());
  const [fen, setFen] = useState(game.fen());
  const [side, setSide] = useState<"w" | "b">("w");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Pick a bot.");

  const engineMove = async (g: Chess, elo: number) => {
    setBusy(true);
    const uci = await getEngine().bestMove(g.fen(), {
      elo: elo >= 3000 ? undefined : elo,
      movetime: 400,
    });
    if (uci && uci !== "(none)") {
      const u = normalizeUci(uci);
      g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: (u[4] as "q") || "q" });
    }
    setFen(g.fen());
    setGame(new Chess(g.fen()));
    setBusy(false);
    const o = outcome(g.fen());
    if (o) setStatus(o.text);
  };

  const start = async (b: (typeof BOTS)[number], playAs: "w" | "b") => {
    const g = new Chess();
    setBot(b);
    setSide(playAs);
    setGame(g);
    setFen(g.fen());
    setStatus(`vs ${b.name}`);
    if (playAs === "b") await engineMove(g, b.elo);
  };

  const onDrop = (from: string, to: string, promotion?: "q" | "r" | "b" | "n") => {
    if (!bot || busy) return false;
    if (game.turn() !== side) return false;
    const g = new Chess(fen);
    try {
      if (!g.move({ from, to, promotion: promotion ?? "q" })) return false;
    } catch {
      return false;
    }
    setFen(g.fen());
    setGame(new Chess(g.fen()));
    const o = outcome(g.fen());
    if (o) setStatus(o.text);
    if (g.isGameOver()) return true;
    engineMove(g, bot.elo);
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
            <button className="btn" onClick={() => setBot(null)}>
              Change bot
            </button>
            <span>{status}</span>
            {busy && <span className="muted">thinking…</span>}
          </div>
          <Board fen={fen} flipped={side === "b"} onDrop={onDrop} allowDrag={!busy} announce />
        </>
      )}
    </>
  );
}
