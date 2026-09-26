"use client";

import { Chess } from "chess.js";
import { useRef, useState } from "react";
import { Board } from "@/components/Board";
import { evalPosition } from "@/lib/analyze";
import { classifyMove, faultCopy } from "@/lib/classify";
import { botPlan, sideCpl, type CoachMode } from "@/lib/coach";
import { getEngine, normalizeUci, pvToSan, uciToSan } from "@/lib/engine";
import { outcome } from "@/lib/outcome";
import type { PositionEval } from "@/lib/types";

const MODES: { id: CoachMode; label: string; blurb: string }[] = [
  { id: "play", label: "Just play", blurb: "A quiet game. No notes." },
  { id: "basics", label: "Mistakes", blurb: "Talk only when a move is weak." },
  { id: "full", label: "Every move", blurb: "Your move, my move, and the plan." },
];

const LEVELS = [
  { name: "Easy", elo: 800 },
  { name: "Club", elo: 1400 },
  { name: "Sharp", elo: 2100 },
];

const DEPTH = 12;

function sameUci(a: string, b: string): boolean {
  return a.slice(0, 4) === b.slice(0, 4);
}

export default function Page() {
  const [mode, setMode] = useState<CoachMode>("basics");
  const [level, setLevel] = useState(LEVELS[1]);
  const [side, setSide] = useState<"w" | "b">("w");
  const [on, setOn] = useState(false);
  const [fen, setFen] = useState(() => new Chess().fen());
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Pick a mode and start.");
  const [log, setLog] = useState<{ who: "you" | "bot" | "sys"; text: string }[]>([]);
  const lastEval = useRef<PositionEval | null>(null);
  const gen = useRef(0);

  const push = (who: "you" | "bot" | "sys", text: string) => setLog((xs) => [...xs, { who, text }]);

  const talkUser = async (fenBefore: string, fenAfter: string, san: string, color: "w" | "b", uci: string) => {
    if (mode === "play") return;
    const before =
      lastEval.current?.fen === fenBefore ? lastEval.current : await evalPosition(fenBefore, DEPTH);
    const after = await evalPosition(fenAfter, DEPTH);
    lastEval.current = after;
    const cpl = sideCpl(before.score, after.score, color);
    if (mode === "basics" && cpl <= 50) return;
    const grade = classifyMove({ cpl, isBest: sameUci(uci, before.bestMove), isSacrifice: false });
    const punish = after.bestMove ? uciToSan(fenAfter, after.bestMove) : "";
    const idea = after.pvs[0] ? pvToSan(fenAfter, after.pvs[0].moves).split(/\s+/).slice(1).join(" ") : "";
    const f = faultCopy(san, uciToSan(fenBefore, before.bestMove), grade, cpl, punish, idea);
    push("you", `${f.title}. ${f.why} ${f.punish}`);
  };

  const engineMove = async (g: Chess, elo: number, id: number) => {
    const fenBefore = g.fen();
    let before = lastEval.current?.fen === fenBefore ? lastEval.current : null;
    if (mode !== "play" && !before) {
      try {
        before = await evalPosition(fenBefore, DEPTH);
        lastEval.current = before;
      } catch {
        /* still play */
      }
    }
    if (id !== gen.current) return;
    const uci = await getEngine().bestMove(fenBefore, {
      elo: elo >= 3000 ? undefined : elo,
      movetime: 400,
    });
    if (id !== gen.current) return;
    let san = "";
    if (uci && uci !== "(none)") {
      const u = normalizeUci(uci);
      const promo = u[4] as "q" | "r" | "b" | "n" | undefined;
      const mv = g.move({ from: u.slice(0, 2), to: u.slice(2, 4), ...(promo ? { promotion: promo } : {}) });
      san = mv.san;
    }
    setFen(g.fen());
    if (mode !== "play") {
      try {
        lastEval.current = await evalPosition(g.fen(), DEPTH);
      } catch {
        /* next user move will refetch */
      }
    }
    if (san && mode === "full") {
      const line = lastEval.current?.pvs[0] ? pvToSan(g.fen(), lastEval.current.pvs[0].moves) : "";
      const best = before?.bestMove ? uciToSan(fenBefore, before.bestMove) : "";
      push("bot", botPlan(san, best, line));
    }
    const o = outcome(g.fen());
    if (o) setStatus(o.text);
  };

  const start = async (playAs: "w" | "b") => {
    const id = ++gen.current;
    const g = new Chess();
    lastEval.current = null;
    setOn(true);
    setSide(playAs);
    setFen(g.fen());
    setLog([]);
    setStatus(`vs ${level.name} · ${MODES.find((m) => m.id === mode)?.label}`);
    setBusy(true);
    if (mode !== "play") {
      try {
        lastEval.current = await evalPosition(g.fen(), DEPTH);
      } catch {
        /* */
      }
    }
    if (playAs === "b" && id === gen.current) await engineMove(g, level.elo, id);
    if (id === gen.current) setBusy(false);
  };

  const onDrop = (from: string, to: string, promotion?: "q" | "r" | "b" | "n") => {
    if (!on || busy) return false;
    const g = new Chess(fen);
    if (g.turn() !== side) return false;
    const fenBefore = g.fen();
    let mv;
    try {
      mv = g.move({ from, to, ...(promotion ? { promotion } : {}) });
    } catch {
      return false;
    }
    if (!mv) return false;
    setFen(g.fen());
    const id = gen.current;
    const uci = `${from}${to}${promotion ?? ""}`;
    void (async () => {
      setBusy(true);
      try {
        await talkUser(fenBefore, g.fen(), mv.san, mv.color, uci);
      } catch {
        /* keep playing */
      }
      if (id !== gen.current) return;
      const o = outcome(g.fen());
      if (o) setStatus(o.text);
      if (!g.isGameOver()) await engineMove(g, level.elo, id);
      if (id === gen.current) setBusy(false);
    })();
    return true;
  };

  return (
    <>
      <h1 className="page-title">Coach</h1>
      <p className="lede">Play a bot. Choose how much it talks — silent, mistakes only, or a plan after every move.</p>
      <div className="row" style={{ marginBottom: 10 }}>
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`btn ${mode === m.id ? "btn-primary" : ""}`}
            disabled={on}
            onClick={() => setMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="muted" style={{ marginBottom: 10 }}>
        {MODES.find((m) => m.id === mode)?.blurb}
      </p>
      {!on ? (
        <>
          <div className="row" style={{ marginBottom: 10 }}>
            {LEVELS.map((lv) => (
              <button
                key={lv.name}
                type="button"
                className={`btn ${level.name === lv.name ? "btn-primary" : ""}`}
                onClick={() => setLevel(lv)}
              >
                {lv.name}
              </button>
            ))}
          </div>
          <div className="row">
            <button className="btn btn-primary" onClick={() => start("w")}>
              White
            </button>
            <button className="btn" onClick={() => start("b")}>
              Black
            </button>
          </div>
        </>
      ) : (
        <div className="grid-2">
          <section>
            <div className="row" style={{ marginBottom: 8 }}>
              <button
                className="btn"
                onClick={() => {
                  gen.current++;
                  setOn(false);
                  setBusy(false);
                  setFen(new Chess().fen());
                  setLog([]);
                  lastEval.current = null;
                  setStatus("Pick a mode and start.");
                }}
              >
                New game
              </button>
              <span>{status}</span>
              {busy && <span className="muted">thinking…</span>}
            </div>
            <Board fen={fen} flipped={side === "b"} onDrop={onDrop} allowDrag={!busy} announce />
          </section>
          <section className="panel">
            <h2>Notes</h2>
            {mode === "play" ? (
              <p className="muted">Just play is on. Switch to a new game to hear the coach.</p>
            ) : (
              <div className="chat" style={{ marginTop: 8 }}>
                {log.length === 0 && <p className="muted">Moves will show up here.</p>}
                {log.map((m, i) => (
                  <div key={i} className={`bubble ${m.who === "you" ? "me" : ""}`}>
                    {m.text}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
