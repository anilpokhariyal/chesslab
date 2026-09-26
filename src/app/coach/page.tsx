"use client";

import { Chess } from "chess.js";
import { useEffect, useRef, useState } from "react";
import { Board } from "@/components/Board";
import { evalPosition } from "@/lib/analyze";
import { classifyMove, faultCopy, GRADE_GLYPH, type Grade } from "@/lib/classify";
import { botPlan, sideCpl, type CoachMode } from "@/lib/coach";
import { getEngine, normalizeUci, pvToSan, uciToSan } from "@/lib/engine";
import { loadGame, outcome } from "@/lib/outcome";
import { recordGame, rememberDraft, useProfile } from "@/lib/store";
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

type Note = { who: "you" | "bot" | "sys"; text: string; san?: string; grade?: Grade; ply?: number };

function fenAtPly(pgn: string, ply: number): string {
  const g = loadGame(pgn);
  while (g.history().length > ply) g.undo();
  return g.fen();
}

function tone(grade?: Grade): string {
  if (grade === "brilliant" || grade === "best" || grade === "good") return "ok";
  if (grade === "inaccuracy") return "iffy";
  if (grade === "mistake" || grade === "blunder") return "bad";
  return "";
}


export default function Page() {
  const profile = useProfile();
  const [mode, setMode] = useState<CoachMode>("basics");
  const [level, setLevel] = useState(LEVELS[1]);
  const [side, setSide] = useState<"w" | "b">("w");
  const [on, setOn] = useState(false);
  const [fen, setFen] = useState(() => new Chess().fen());
  const [pgn, setPgn] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Pick a mode and start.");
  const [log, setLog] = useState<Note[]>([]);
  const [review, setReview] = useState<string | null>(null);
  const lastEval = useRef<PositionEval | null>(null);
  const gen = useRef(0);
  const logRef = useRef(log);

  useEffect(() => {
    if (on || !profile.coach) return;
    const d = profile.coach;
    const g = loadGame(d.pgn, d.fen);
    setOn(true);
    setSide(d.side);
    setFen(g.fen());
    setPgn(g.pgn());
    setStatus(d.status);
    setLog((d.log ?? []) as Note[]);
    logRef.current = (d.log ?? []) as Note[];
    setReview(null);
    if (d.mode) setMode(d.mode);
    const lv = LEVELS.find((x) => x.name === d.opp || x.elo === d.elo);
    if (lv) setLevel(lv);
  }, [on, profile.coach]);

  const push = (note: Note) =>
    setLog((xs) => {
      const next = [...xs, note];
      logRef.current = next;
      return next;
    });

  const persist = (g: Chess, text: string, playAs: "w" | "b", talk: CoachMode, lv: (typeof LEVELS)[number]) => {
    if (g.isGameOver()) {
      recordGame({
        id: crypto.randomUUID(),
        at: Date.now(),
        kind: "coach",
        pgn: g.pgn(),
        result: text,
        opp: lv.name,
      });
      return;
    }
    rememberDraft("coach", {
      opp: lv.name,
      elo: lv.elo,
      side: playAs,
      fen: g.fen(),
      pgn: g.pgn(),
      status: text,
      mode: talk,
      log: logRef.current,
    });
  };

  const talkUser = async (fenBefore: string, fenAfter: string, san: string, color: "w" | "b", uci: string, ply: number) => {
    if (mode === "play") return;
    const before =
      lastEval.current?.fen === fenBefore ? lastEval.current : await evalPosition(fenBefore, DEPTH);
    const after = await evalPosition(fenAfter, DEPTH);
    lastEval.current = after;
    const cpl = sideCpl(before.score, after.score, color);
    const grade = classifyMove({ cpl, isBest: sameUci(uci, before.bestMove), isSacrifice: false });
    if (mode === "basics" && grade === "good") return;
    const best = uciToSan(fenBefore, before.bestMove);
    if (grade === "best" || grade === "brilliant" || grade === "good") {
      push({
        who: "you",
        san,
        grade,
        ply,
        text:
          grade === "brilliant"
            ? `Excellent. ${san} is a sharp find.`
            : grade === "best"
              ? `Best. ${san} matches the engine.`
              : `Good. ${san} is solid.${best && best !== san ? ` Engine likes ${best} a bit more.` : ""}`,
      });
      return;
    }
    const punish = after.bestMove ? uciToSan(fenAfter, after.bestMove) : "";
    const idea = after.pvs[0] ? pvToSan(fenAfter, after.pvs[0].moves).split(/\s+/).slice(1).join(" ") : "";
    const f = faultCopy(san, best, grade, cpl, punish, idea);
    push({ who: "you", san, grade, ply, text: `${f.title}. ${f.why} ${f.punish}` });
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
    setPgn(g.pgn());
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
      push({ who: "bot", san, ply: g.history().length, text: botPlan(san, best, line) });
    }
    const o = outcome(g.fen(), g.pgn());
    const text = o?.text ?? `vs ${level.name} · ${MODES.find((m) => m.id === mode)?.label}`;
    if (o) setStatus(text);
    persist(g, text, side, mode, level);
  };

  const start = async (playAs: "w" | "b") => {
    const id = ++gen.current;
    const g = new Chess();
    lastEval.current = null;
    setOn(true);
    setSide(playAs);
    setFen(g.fen());
    setPgn("");
    setLog([]);
    setReview(null);
    setStatus(`vs ${level.name} · ${MODES.find((m) => m.id === mode)?.label}`);
    setBusy(true);
    if (mode !== "play") {
      try {
        lastEval.current = await evalPosition(g.fen(), DEPTH);
      } catch {
        /* */
      }
    }
    persist(g, `vs ${level.name} · ${MODES.find((m) => m.id === mode)?.label}`, playAs, mode, level);
    if (playAs === "b" && id === gen.current) await engineMove(g, level.elo, id);
    if (id === gen.current) setBusy(false);
  };

  const onDrop = (from: string, to: string, promotion?: "q" | "r" | "b" | "n") => {
    if (!on || busy) return false;
    const g = loadGame(pgn, fen);
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
    setPgn(g.pgn());
    setReview(null);
    const id = gen.current;
    const uci = `${from}${to}${promotion ?? ""}`;
    void (async () => {
      setBusy(true);
      try {
        await talkUser(fenBefore, g.fen(), mv.san, mv.color, uci, g.history().length);
      } catch {
        /* keep playing */
      }
      if (id !== gen.current) return;
      const o = outcome(g.fen(), g.pgn());
      const text = o?.text ?? `vs ${level.name} · ${MODES.find((m) => m.id === mode)?.label}`;
      if (o) setStatus(text);
      persist(g, text, side, mode, level);
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
        <div className="grid-2 fill">
          <section>
            <div className="row" style={{ marginBottom: 8 }}>
              <button
                className="btn"
                onClick={() => {
                  gen.current++;
                  rememberDraft("coach", null);
                  setOn(false);
                  setBusy(false);
                  setFen(new Chess().fen());
                  setPgn("");
                  setLog([]);
                  logRef.current = [];
                  setReview(null);
                  lastEval.current = null;
                  setStatus("Pick a mode and start.");
                }}
              >
                New game
              </button>
              <span>{status}</span>
              {busy && <span className="muted">thinking…</span>}
            </div>
            <Board
              fen={review ?? fen}
              pgn={review ? undefined : pgn}
              flipped={side === "b"}
              onDrop={onDrop}
              allowDrag={!busy && !review}
              announce
            />
            {review && <p className="muted" style={{ marginTop: 6 }}>Reviewing a note. Click another, or play to return.</p>}
          </section>
          <section className="panel">
            <h2>Notes</h2>
            {mode === "play" ? (
              <p className="muted">Just play is on. Switch to a new game to hear the coach.</p>
            ) : (
              <div className="chat" style={{ marginTop: 8 }}>
                {log.length === 0 && <p className="muted">Moves will show up here.</p>}
                {[...log].reverse().map((m, i) => {
                  const at = m.ply != null && pgn ? fenAtPly(pgn, m.ply) : "";
                  return (
                    <button
                      key={`${m.ply ?? 0}-${i}`}
                      type="button"
                      className={`bubble ${tone(m.grade)}${review && at && review === at ? " on" : ""}`}
                      disabled={m.ply == null || !pgn}
                      onClick={() => m.ply != null && setReview(fenAtPly(pgn, m.ply))}
                    >
                      <span className={`san ${m.grade ? `grade ${m.grade}` : ""}`}>
                        {m.san ?? "—"}
                        {m.grade && GRADE_GLYPH[m.grade] ? ` ${GRADE_GLYPH[m.grade]}` : ""}
                      </span>
                      <span>{m.text}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
