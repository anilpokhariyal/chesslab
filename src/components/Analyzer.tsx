"use client";

import { Chess } from "chess.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Arrow } from "react-chessboard";
import { chessComGames, lichessGames, type PlatformGame } from "@/lib/api";
import { analyzeGame, evalPosition, formatScore } from "@/lib/analyze";
import { getEngine, pvToSan, scoreToWhiteCp, uciToSan } from "@/lib/engine";
import { classifyMove, faultCopy, GRADE_LABEL } from "@/lib/classify";
import { depthFor, loadProfile, saveAnalysis } from "@/lib/store";
import type { PositionEval, SavedAnalysis, Score } from "@/lib/types";
import { Board } from "./Board";
import { EvalBar } from "./EvalBar";

const START = new Chess().fen();

function sameUci(a: string, b: string): boolean {
  return a.slice(0, 4) === b.slice(0, 4);
}
const SETUP_PIECES = ["K", "Q", "R", "B", "N", "P", "k", "q", "r", "b", "n", "p"] as const;

function fenFromMap(map: Record<string, string>, turn: "w" | "b"): string {
  const rows = [];
  for (let r = 8; r >= 1; r--) {
    let row = "";
    let empty = 0;
    for (const f of "abcdefgh") {
      const p = map[`${f}${r}`];
      if (!p) empty++;
      else {
        if (empty) row += empty;
        empty = 0;
        row += p;
      }
    }
    if (empty) row += empty;
    rows.push(row);
  }
  return `${rows.join("/")} ${turn} - - 0 1`;
}

function mapFromFen(fen: string): Record<string, string> {
  const g = new Chess();
  try {
    g.load(fen);
  } catch {
    return {};
  }
  const map: Record<string, string> = {};
  for (const sq of g.board().flat()) {
    if (!sq) continue;
    map[sq.square] = sq.color === "w" ? sq.type.toUpperCase() : sq.type;
  }
  return map;
}

export function Analyzer() {
  const [tab, setTab] = useState<"pgn" | "chesscom" | "lichess" | "setup">("pgn");
  const [pgn, setPgn] = useState("");
  const [user, setUser] = useState("");
  const [games, setGames] = useState<PlatformGame[]>([]);
  const [err, setErr] = useState("");
  const [startFen, setStartFen] = useState(START);
  const [history, setHistory] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const fullRef = useRef(false);
  const [ply, setPly] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [analysis, setAnalysis] = useState<SavedAnalysis | null>(null);
  const [live, setLive] = useState<PositionEval | null>(null);
  const [busy, setBusy] = useState("");
  const [progress, setProgress] = useState(0);
  const [setupTurn, setSetupTurn] = useState<"w" | "b">("w");
  const [setupMap, setSetupMap] = useState<Record<string, string>>(mapFromFen(START));
  const [hold, setHold] = useState<string | null>(null);
  const [headers, setHeaders] = useState({ white: "White", black: "Black", result: "*" });
  const [fault, setFault] = useState<ReturnType<typeof faultCopy> | null>(null);
  const [waitingFault, setWaitingFault] = useState(false);
  const pendingFault = useRef<{
    playedSan: string;
    color: "w" | "b";
    bestSan: string;
    scoreBefore: Score;
  } | null>(null);
  const lastTip = useRef<{ fen: string; bestMove: string; score: Score } | null>(null);

  const currentFen = useMemo(() => {
    if (tab === "setup" && !history.length) return fenFromMap(setupMap, setupTurn);
    const g = new Chess();
    try {
      if (pgn) g.loadPgn(pgn);
      else g.load(startFen);
    } catch {
      /* ignore */
    }
    const start = g.history({ verbose: true })[0]?.before ?? startFen;
    const replay = new Chess(start);
    const moves = g.history();
    for (let i = 0; i < Math.min(ply, moves.length); i++) replay.move(moves[i]);
    if (history.length && ply >= moves.length) {
      for (const san of history.slice(0, ply - moves.length)) {
        try {
          replay.move(san);
        } catch {
          break;
        }
      }
    }
    return replay.fen();
  }, [pgn, ply, history, tab, setupMap, setupTurn, startFen]);

  const loadPgn = (text: string) => {
    try {
      const g = new Chess();
      g.loadPgn(text);
      setPgn(g.pgn());
      setHistory([]);
      setStartFen(g.history({ verbose: true })[0]?.before ?? START);
      setPly(g.history().length);
      setHeaders({
        white: g.header().White ?? "White",
        black: g.header().Black ?? "Black",
        result: g.header().Result ?? "*",
      });
      setAnalysis(null);
      setErr("");
      setTab("pgn");
      setFault(null);
      pendingFault.current = null;
      setWaitingFault(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Bad PGN");
    }
  };

  const fetchGames = async (site: "chesscom" | "lichess") => {
    setBusy("Loading games…");
    setErr("");
    try {
      const handle = user.trim() || loadProfile().name;
      const list = site === "chesscom" ? await chessComGames(handle) : await lichessGames(handle);
      setGames(list);
      if (!list.length) setErr(`No public games for “${handle.trim().toLowerCase()}”.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Fetch failed");
    } finally {
      setBusy("");
    }
  };

  const goPly = (n: number) => {
    const g = new Chess();
    try {
      if (pgn) g.loadPgn(pgn);
      else g.load(startFen);
    } catch {
      /* */
    }
    const max = g.history().length + history.length;
    setPly(Math.max(0, Math.min(max, n)));
    setFault(null);
    pendingFault.current = null;
    setWaitingFault(false);
  };

  const onDrop = (from: string, to: string, promotion?: "q" | "r" | "b" | "n") => {
    const g = new Chess(currentFen);
    try {
      const mv = g.move({ from, to, promotion: promotion ?? "q" });
      if (!mv) return false;
      const played = `${from}${to}${promotion ?? ""}`;
      const tip = lastTip.current?.fen === currentFen ? lastTip.current : live?.fen === currentFen ? live : null;
      const suggested = tip?.bestMove ?? "";
      if (suggested && !sameUci(played, suggested)) {
        pendingFault.current = {
          playedSan: mv.san,
          color: mv.color,
          bestSan: uciToSan(currentFen, suggested),
          scoreBefore: tip!.score,
        };
        setWaitingFault(true);
        setFault(null);
      } else {
        pendingFault.current = null;
        setWaitingFault(false);
        setFault(null);
      }
      const base = new Chess();
      try {
        if (pgn) base.loadPgn(pgn);
      } catch {
        /* */
      }
      const main = base.history();
      if (ply < main.length) {
        setHistory([mv.san]);
        setPly(ply + 1);
        const cut = new Chess();
        if (pgn) cut.loadPgn(pgn);
        while (cut.history().length > ply) cut.undo();
        setPgn(cut.pgn());
      } else {
        setHistory((h) => [...h.slice(0, ply - main.length), mv.san]);
        setPly(ply + 1);
      }
      return true;
    } catch {
      return false;
    }
  };

  const settleFault = (ev: PositionEval, fen: string) => {
    const pending = pendingFault.current;
    if (!pending || ev.fen !== fen) return;
    pendingFault.current = null;
    const best = scoreToWhiteCp(pending.scoreBefore);
    const played = scoreToWhiteCp(ev.score);
    const signedBest = pending.color === "w" ? best : -best;
    const signedPlayed = pending.color === "w" ? played : -played;
    const cpl = Math.max(0, Math.round(signedBest - signedPlayed));
    const grade = classifyMove({ cpl, isBest: false, isSacrifice: false });
    setWaitingFault(false);
    const punish = ev.bestMove ? uciToSan(fen, ev.bestMove) : "";
    const idea = ev.pvs[0] ? pvToSan(fen, ev.pvs[0].moves).split(/\s+/).slice(1).join(" ") : "";
    setFault(faultCopy(pending.playedSan, pending.bestSan, grade, cpl, punish, idea));
  };

  useEffect(() => {
    if (tab === "setup" || fullRef.current) return;
    let gone = false;
    const t = setTimeout(async () => {
      try {
        const ev = await evalPosition(currentFen, Math.min(14, depthFor(loadProfile().plan)));
        if (gone) return;
        setLive(ev);
        if (ev.bestMove) lastTip.current = { fen: ev.fen, bestMove: ev.bestMove, score: ev.score };
        settleFault(ev, currentFen);
      } catch {
        if (!gone) setWaitingFault(false);
      }
    }, 250);
    return () => {
      gone = true;
      clearTimeout(t);
    };
  }, [currentFen, tab]);

  const runLive = useCallback(async () => {
    const plan = loadProfile().plan;
    setBusy("Evaluating…");
    try {
      const ev = await evalPosition(currentFen, Math.min(14, depthFor(plan)));
      setLive(ev);
      if (ev.bestMove) lastTip.current = { fen: ev.fen, bestMove: ev.bestMove, score: ev.score };
      settleFault(ev, currentFen);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Engine failed");
    } finally {
      setBusy("");
    }
  }, [currentFen]);

  const gamePgn = () => {
    if (pgn) return pgn;
    const g = new Chess(startFen);
    for (const san of history) g.move(san);
    return g.pgn();
  };

  const cancelFull = () => {
    abortRef.current?.abort();
    getEngine().stop();
  };

  const runFull = async () => {
    const text = gamePgn();
    if (!text && !sans.length) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    fullRef.current = true;
    const plan = loadProfile().plan;
    setBusy("Full analysis…");
    setProgress(0);
    try {
      const a = await analyzeGame(text, depthFor(plan), (d, t) => setProgress(d / t), ac.signal);
      setAnalysis(a);
      saveAnalysis(a);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setErr(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      fullRef.current = false;
      setBusy("");
    }
  };

  const applySetup = () => {
    const f = fenFromMap(setupMap, setupTurn);
    try {
      const g = new Chess(f);
      setStartFen(g.fen());
      setPgn("");
      setHistory([]);
      setPly(0);
      setTab("pgn");
      setAnalysis(null);
      setLive(null);
      setFault(null);
      pendingFault.current = null;
      setWaitingFault(false);
      setErr("");
    } catch {
      setErr("Illegal setup — both kings required, no checks on the idle king.");
    }
  };

  const place = (sq: string) => {
    if (!hold) {
      setSetupMap((m) => {
        const n = { ...m };
        delete n[sq];
        return n;
      });
      return;
    }
    setSetupMap((m) => ({ ...m, [sq]: hold }));
  };

  const sans = (() => {
    const g = new Chess();
    try {
      if (pgn) g.loadPgn(pgn);
      else g.load(startFen);
    } catch {
      /* */
    }
    return [...g.history(), ...history];
  })();

  const moveAt = analysis?.moves[ply - 1];
  const tip = live?.fen === currentFen ? live : null;
  const arrows: Arrow[] = [];
  const bestUci = tip?.bestMove ?? "";
  if (bestUci.length >= 4) {
    arrows.push({ startSquare: bestUci.slice(0, 2), endSquare: bestUci.slice(2, 4), color: "#3d9b6e" });
  }

  const counts = analysis
    ? analysis.moves.reduce(
        (acc, m) => {
          acc[m.grade] = (acc[m.grade] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      )
    : {};

  return (
    <>
      <h1 className="page-title">Game analyzer</h1>
      <p className="lede">Paste a PGN, pull Chess.com / Lichess games, or set a position. Stockfish runs in your browser.</p>
      <div className="grid-3">
        <section>
          <div className="board-row">
            <EvalBar score={moveAt?.evalAfter ?? tip?.score} flipped={flipped} />
            <Board
              fen={tab === "setup" && !history.length ? fenFromMap(setupMap, setupTurn) : currentFen}
              flipped={flipped}
              arrows={tab === "setup" ? [] : arrows}
              allowDrag={tab !== "setup"}
              onDrop={onDrop}
              onSquareClick={tab === "setup" ? place : undefined}
              announce={tab !== "setup"}
            />
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn" onClick={() => goPly(0)}>
              Start
            </button>
            <button className="btn" onClick={() => goPly(ply - 1)}>
              Prev
            </button>
            <button className="btn" onClick={() => goPly(ply + 1)}>
              Next
            </button>
            <button className="btn" onClick={() => goPly(999)}>
              End
            </button>
            <button className="btn" onClick={() => setFlipped((f) => !f)}>
              Flip
            </button>
            <button
              className="btn"
              onClick={() => {
                setPgn("");
                setHistory([]);
                setStartFen(START);
                setPly(0);
                setAnalysis(null);
                setLive(null);
                setFault(null);
                pendingFault.current = null;
                setWaitingFault(false);
              }}
            >
              Clear
            </button>
          </div>
          <p className="muted" style={{ marginTop: 8 }}>
            {headers.white} — {headers.black} {headers.result}
            {busy && ` · ${busy}`}
          </p>
          {busy && <div className="progress" style={{ marginTop: 6 }}><i style={{ width: `${progress * 100}%` }} /></div>}
        </section>

        <section className="panel">
          <div className="tabs">
            {(["pgn", "chesscom", "lichess", "setup"] as const).map((t) => (
              <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
                {t === "chesscom" ? "Chess.com" : t === "lichess" ? "Lichess" : t === "setup" ? "Setup" : "Paste PGN"}
              </button>
            ))}
          </div>
          {tab === "pgn" && (
            <>
              <textarea
                value={pgn}
                onChange={(e) => setPgn(e.target.value)}
                placeholder={'[Event "Casual"]\n1. e4 e5 2. Nf3 Nc6'}
              />
              <div className="row" style={{ marginTop: 8 }}>
                <button className="btn btn-primary" onClick={() => loadPgn(pgn)}>
                  Load PGN
                </button>
              </div>
            </>
          )}
          {(tab === "chesscom" || tab === "lichess") && (
            <>
              <input type="text" placeholder="Username" value={user} onChange={(e) => setUser(e.target.value)} />
              <div className="row" style={{ marginTop: 8 }}>
                <button className="btn btn-primary" onClick={() => fetchGames(tab)}>
                  Load games
                </button>
              </div>
              <div className="game-list" style={{ marginTop: 8 }}>
                {games.map((g) => (
                  <button key={g.id} className="btn" onClick={() => loadPgn(g.pgn)}>
                    {g.white} vs {g.black} {g.result} {g.time ? `· ${g.time}` : ""}
                  </button>
                ))}
              </div>
            </>
          )}
          {tab === "setup" && (
            <>
              <p className="muted">Pick a piece, click a square. Click empty with no piece selected to clear.</p>
              <div className="palette" style={{ margin: "8px 0" }}>
                {SETUP_PIECES.map((p) => (
                  <button key={p} className={`btn ${hold === p ? "btn-primary" : ""}`} onClick={() => setHold(p)}>
                    {p}
                  </button>
                ))}
              </div>
              <div className="row">
                <button className="btn" onClick={() => setSetupTurn((t) => (t === "w" ? "b" : "w"))}>
                  Side: {setupTurn === "w" ? "White" : "Black"}
                </button>
                <button className="btn" onClick={() => setSetupMap(mapFromFen(START))}>
                  Start pos
                </button>
                <button className="btn" onClick={() => setSetupMap({})}>
                  Empty
                </button>
                <button className="btn btn-primary" onClick={applySetup}>
                  Use position
                </button>
              </div>
            </>
          )}
          {err && <p className="grade blunder" style={{ marginTop: 8 }}>{err}</p>}

          <h2 style={{ marginTop: 16 }}>Moves</h2>
          <div className="moves">
            {Array.from({ length: Math.ceil(sans.length / 2) }, (_, i) => {
              const w = sans[i * 2];
              const b = sans[i * 2 + 1];
              const wg = analysis?.moves[i * 2];
              const bg = analysis?.moves[i * 2 + 1];
              return (
                <span key={i} style={{ display: "contents" }}>
                  <span className="muted">{i + 1}.</span>
                  <button className={ply === i * 2 + 1 ? "on" : ""} onClick={() => goPly(i * 2 + 1)}>
                    {w} {wg && <span className={`grade ${wg.grade}`}>{GRADE_LABEL[wg.grade]}</span>}
                  </button>
                  <button className={ply === i * 2 + 2 ? "on" : ""} onClick={() => goPly(i * 2 + 2)} disabled={!b}>
                    {b} {bg && <span className={`grade ${bg.grade}`}>{GRADE_LABEL[bg.grade]}</span>}
                  </button>
                </span>
              );
            })}
          </div>
        </section>

        <section className="panel">
          {(fault || waitingFault) && (
            <div className="fault">
              <h2>Why that move</h2>
              {waitingFault && !fault && <p className="muted">Checking why that move is weaker…</p>}
              {fault && (
                <>
                  <p>
                    <span className={`grade ${fault.grade}`}>{fault.title}</span> — {fault.why}
                  </p>
                  <p>{fault.punish}</p>
                </>
              )}
            </div>
          )}
          <div className="row">
            <button className="btn" onClick={runLive} disabled={!!busy}>
              Analyze position
            </button>
            {busy === "Full analysis…" ? (
              <button className="btn" onClick={cancelFull}>
                Cancel
              </button>
            ) : (
              <button className="btn btn-primary" onClick={runFull} disabled={!!busy || (sans.length === 0 && !pgn)}>
                Full game analysis
              </button>
            )}
          </div>
          <h2 style={{ marginTop: 12 }}>Best move</h2>
          <p>
            {tip
              ? `${uciToSan(currentFen, tip.bestMove)} (${formatScore(tip.score)})`
              : moveAt
                ? `${moveAt.bestSan} (${formatScore(moveAt.evalBefore)})`
                : "No engine suggestion yet."}
          </p>
          <h2 style={{ marginTop: 12 }}>Top moves</h2>
          {(tip?.pvs ?? []).map((pv, i) => (
            <p key={i} className="pv">
              {formatScore(pv.score)} · {pvToSan(currentFen, pv.moves) || pv.moves.slice(0, 8).join(" ")}
            </p>
          ))}
          <h2 style={{ marginTop: 12 }}>Accuracy</h2>
          {analysis ? (
            <>
              <div className="stat">
                <span>White</span>
                <span>{analysis.whiteAccuracy.toFixed(1)}% · ACPL {analysis.whiteAcpl.toFixed(0)}</span>
              </div>
              <div className="stat">
                <span>Black</span>
                <span>{analysis.blackAccuracy.toFixed(1)}% · ACPL {analysis.blackAcpl.toFixed(0)}</span>
              </div>
              {analysis.opening && <p className="muted">{analysis.opening}</p>}
            </>
          ) : (
            <p className="muted">Run full analysis to see accuracy.</p>
          )}
          <h2 style={{ marginTop: 12 }}>Summary</h2>
          {analysis ? (
            <p className="muted">
              {Object.entries(counts)
                .map(([k, v]) => `${v} ${k}`)
                .join(" · ")}
            </p>
          ) : (
            <p className="muted">Run full analysis to see move breakdown.</p>
          )}
          {moveAt && (
            <p style={{ marginTop: 8 }}>
              Played <strong>{moveAt.san}</strong> ({formatScore(moveAt.evalAfter)}). Best{" "}
              <strong>{moveAt.bestSan}</strong>. <span className={`grade ${moveAt.grade}`}>{GRADE_LABEL[moveAt.grade]}</span>
            </p>
          )}
        </section>
      </div>
    </>
  );
}
