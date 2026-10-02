"use client";

import { Chess } from "chess.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Arrow } from "react-chessboard";
import { chessComGames, lichessGames, type PlatformGame } from "@/lib/api";
import { analyzeGame, evalPosition, formatScore } from "@/lib/analyze";
import { fenAfterUci, getEngine, pvToSan, scoreToWhiteCp, uciToSan } from "@/lib/engine";
import { classifyMove, faultCopy, GRADE_GLYPH, GRADE_LABEL, GRADE_ORDER, nextGradePly, type Grade } from "@/lib/classify";
import { depthFor, loadProfile, patchProfile, saveAnalysis, useProfile } from "@/lib/store";
import type { PositionEval, SavedAnalysis, Score } from "@/lib/types";
import { openingLine, OPENINGS } from "@/lib/openings";
import { Board } from "./Board";
import { EvalBar } from "./EvalBar";

const START = new Chess().fen();

function sideOf(cp: number): -1 | 0 | 1 {
  return cp > 20 ? 1 : cp < -20 ? -1 : 0;
}

function movePts(m?: { evalAfter: Score }, prev?: { evalAfter: Score }) {
  if (!m) return <span className="pts" />;
  const cp = scoreToWhiteCp(m.evalAfter);
  const prevCp = prev ? scoreToWhiteCp(prev.evalAfter) : 0;
  const flip = !!prev && sideOf(cp) !== sideOf(prevCp) && !!sideOf(cp) && !!sideOf(prevCp);
  const drop =
    !!prev &&
    m.evalAfter.type === "cp" &&
    prev.evalAfter.type === "cp" &&
    Math.abs(prevCp) >= 150 &&
    Math.abs(prevCp) - Math.abs(cp) >= 100;
  return (
    <span className={`pts ${cp > 0 ? "plus" : cp < 0 ? "minus" : ""}${flip || drop ? " swing" : ""}`}>
      {formatScore(m.evalAfter)}
    </span>
  );
}

function sameUci(a: string, b: string): boolean {
  return a.slice(0, 4) === b.slice(0, 4);
}
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
  const body = rows.join("/");
  if (turn === "w" && body === START.split(" ")[0]) return START;
  return `${body} ${turn} - - 0 1`;
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
  const profile = useProfile();
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
  const [altPly, setAltPly] = useState<number | null>(null);
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
  const [ask, setAsk] = useState<PlatformGame | null>(null);
  const askRef = useRef<HTMLDialogElement>(null);
  const pendingFault = useRef<{
    playedSan: string;
    color: "w" | "b";
    bestSan: string;
    scoreBefore: Score;
  } | null>(null);
  const lastTip = useRef<{ fen: string; bestMove: string; score: Score } | null>(null);
  const playTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (tab === "chesscom") setUser(profile.chessCom);
    if (tab === "lichess") setUser(profile.lichess);
  }, [tab, profile.chessCom, profile.lichess]);

  useEffect(() => {
    document.querySelector(".moves button.on")?.scrollIntoView({ block: "nearest" });
  }, [ply]);

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

  const loadPgn = (text: string): string | null => {
    try {
      const g = new Chess();
      g.loadPgn(text);
      const loaded = g.pgn();
      setPgn(loaded);
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
      return loaded;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Bad PGN");
      return null;
    }
  };

  const fetchGames = async (site: "chesscom" | "lichess") => {
    setBusy("Loading games…");
    setErr("");
    try {
      const handle = (user.trim() || (site === "chesscom" ? profile.chessCom : profile.lichess)).toLowerCase();
      const list = site === "chesscom" ? await chessComGames(handle) : await lichessGames(handle);
      setGames(list);
      if (handle) {
        patchProfile((p) => ({ ...p, [site === "chesscom" ? "chessCom" : "lichess"]: handle.slice(0, 64) }));
      }
      if (!list.length) setErr(`No public games for “${handle}”.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Fetch failed");
    } finally {
      setBusy("");
    }
  };

  const goPly = (n: number, play = false) => {
    const g = new Chess();
    try {
      if (pgn) g.loadPgn(pgn);
      else g.load(startFen);
    } catch {
      /* */
    }
    const max = g.history().length + history.length;
    const target = Math.max(0, Math.min(max, n));
    setAltPly(null);
    clearTimeout(playTimer.current);
    setFault(null);
    pendingFault.current = null;
    setWaitingFault(false);
    if (play && target > 0) {
      setPly(target - 1);
      playTimer.current = setTimeout(() => setPly(target), 120);
      return;
    }
    setPly(target);
  };

  const jumpGrade = (grade: Grade) => {
    const next = analysis ? nextGradePly(analysis.moves.map((m) => m.grade), ply, grade) : null;
    if (next) goPly(next, true);
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
    if (tab === "setup") {
      try {
        new Chess(currentFen);
      } catch {
        setErr("Need both kings, no pawns on the back rank, and the other side must not already be in check.");
        return;
      }
      setAnalysis(null);
      setPgn("");
      setHistory([]);
      setPly(0);
      setStartFen(currentFen);
      setErr("");
    }
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
  }, [currentFen, tab]);

  const gamePgn = () => {
    const g = new Chess();
    try {
      if (pgn) g.loadPgn(pgn);
      else g.load(startFen);
    } catch {
      /* */
    }
    for (const san of history) {
      try {
        g.move(san);
      } catch {
        break;
      }
    }
    return g.pgn();
  };

  const cancelFull = () => {
    abortRef.current?.abort();
    getEngine().stop();
  };

  const runFull = async (from?: string) => {
    const text = typeof from === "string" ? from : gamePgn();
    if (!text && !sans.length) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    fullRef.current = true;
    const plan = loadProfile().plan;
    setBusy("Full analysis…");
    setErr("");
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

  const startImported = (mode: "full" | "manual") => {
    if (!ask) return;
    const handle = (user.trim() || (tab === "lichess" ? profile.lichess : profile.chessCom)).trim().toLowerCase();
    setFlipped(!!handle && ask.black.toLowerCase() === handle);
    const loaded = loadPgn(ask.pgn);
    setAsk(null);
    if (mode === "full" && loaded) void runFull(loaded);
  };

  useEffect(() => {
    const d = askRef.current;
    if (!d) return;
    if (ask && !d.open) d.showModal();
    if (!ask && d.open) d.close();
  }, [ask]);

  const place = (sq: string) => {
    if (sq.startsWith("spare:")) {
      const p = sq.slice(6);
      setHold((h) => (h === p ? null : p));
      return;
    }
    if (hold === "") {
      setSetupMap((m) => {
        const n = { ...m };
        delete n[sq];
        return n;
      });
      return;
    }
    if (!hold) return;
    setSetupMap((m) => ({ ...m, [sq]: hold }));
  };

  const onEdit = (e: { to: string | null; from: string | null; piece: string | null }) => {
    setSetupMap((m) => {
      const n = { ...m };
      if (e.from) delete n[e.from];
      if (e.to && e.piece) n[e.to] = e.piece;
      return n;
    });
    setHold(null);
  };

  const loadOpening = (value: string) => {
    const [id, chapter] = value.split(":");
    try {
      const line = openingLine(id, Number(chapter));
      setFlipped(line.color === "black");
      setSetupMap(mapFromFen(line.fen));
      setSetupTurn(line.fen.split(" ")[1] === "b" ? "b" : "w");
      loadPgn(line.pgn);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load that opening");
    }
  };

  const playFromSetup = () => {
    const fen = fenFromMap(setupMap, setupTurn);
    try {
      const g = new Chess(fen);
      setStartFen(g.fen());
      setPgn(g.pgn());
      setHistory([]);
      setPly(0);
      setAnalysis(null);
      setLive(null);
      setFault(null);
      pendingFault.current = null;
      setWaitingFault(false);
      setTab("pgn");
      setErr("");
    } catch {
      setErr("Need both kings, no pawns on the back rank, and the other side must not already be in check.");
    }
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

  const moveAt = tab === "setup" ? undefined : analysis?.moves[ply - 1];
  const tryAlt =
    moveAt &&
    (moveAt.grade === "mistake" || moveAt.grade === "blunder") &&
    moveAt.bestSan &&
    moveAt.bestUci !== moveAt.uci
      ? fenAfterUci(moveAt.fenBefore, moveAt.bestUci)
      : null;
  const altFen = altPly === ply ? tryAlt : null;
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
            <EvalBar score={altFen ? moveAt?.evalBefore : (moveAt?.evalAfter ?? tip?.score)} flipped={flipped} />
            <Board
              fen={altFen ?? (tab === "setup" && !history.length ? fenFromMap(setupMap, setupTurn) : currentFen)}
              pgn={altFen || tab === "setup" ? undefined : gamePgn()}
              flipped={flipped}
              arrows={altFen || tab === "setup" ? [] : arrows}
              allowDrag={tab !== "setup" && !altFen}
              onDrop={onDrop}
              onSquareClick={tab === "setup" ? place : undefined}
              onEdit={tab === "setup" ? onEdit : undefined}
              held={hold}
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
          {tryAlt && moveAt && (
            <div className="row" style={{ marginTop: 8 }}>
              {altFen ? (
                <>
                  <span>
                    {moveAt.bestSan} instead of {moveAt.san}. About {moveAt.cpl}cp better for {moveAt.color === "w" ? "White" : "Black"} — White&apos;s eval stays {formatScore(moveAt.evalBefore)} instead of {formatScore(moveAt.evalAfter)}.
                  </span>
                  <button type="button" className="btn" onClick={() => setAltPly(null)}>
                    Back to {moveAt.san}
                  </button>
                </>
              ) : (
                <button type="button" className="btn btn-primary" onClick={() => setAltPly(ply)}>
                  See {moveAt.bestSan} instead
                </button>
              )}
            </div>
          )}
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
              <input
                type="text"
                placeholder={tab === "chesscom" ? "Chess.com username" : "Lichess username"}
                value={user}
                onChange={(e) => setUser(e.target.value)}
                autoComplete="username"
              />
              <div className="row" style={{ marginTop: 8 }}>
                <button className="btn btn-primary" onClick={() => fetchGames(tab)}>
                  Load games
                </button>
              </div>
              <div className="game-list" style={{ marginTop: 8 }}>
                {games.map((g) => (
                  <button key={g.id} className="btn" onClick={() => setAsk(g)}>
                    {g.white} vs {g.black} {g.result} {g.time ? `· ${g.time}` : ""}
                  </button>
                ))}
              </div>
            </>
          )}
          {tab === "setup" && (
            <>
              <p className="muted">Load a known opening to study the middlegame, or drag pieces onto squares.</p>
              <select aria-label="Load a known opening" defaultValue="" onChange={(e) => { if (e.target.value) loadOpening(e.target.value); e.target.value = ""; }} style={{ marginTop: 8 }}>
                <option value="">Load a known opening…</option>
                {OPENINGS.map((o) => (
                  <optgroup key={o.id} label={o.name}>
                    {o.chapters.map((c, i) => (
                      <option key={c.name} value={`${o.id}:${i}`}>{c.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <div className="row" style={{ marginTop: 8 }}>
                <button type="button" className={`btn${hold === "" ? " btn-primary" : ""}`} onClick={() => setHold((h) => (h === "" ? null : ""))}>
                  Erase
                </button>
                <span className="muted">To move</span>
                <button type="button" className={`btn${setupTurn === "w" ? " btn-primary" : ""}`} onClick={() => setSetupTurn("w")}>
                  White
                </button>
                <button type="button" className={`btn${setupTurn === "b" ? " btn-primary" : ""}`} onClick={() => setSetupTurn("b")}>
                  Black
                </button>
                <button type="button" className="btn" onClick={() => { setSetupMap(mapFromFen(START)); setErr(""); }}>
                  Start
                </button>
                <button type="button" className="btn" onClick={() => { setSetupMap({}); setErr(""); }}>
                  Clear
                </button>
                <button type="button" className="btn btn-primary" onClick={playFromSetup}>
                  Play from here
                </button>
              </div>
            </>
          )}
          {err && <p className="grade blunder" style={{ marginTop: 8 }}>{err}</p>}

          <h2 style={{ marginTop: 16 }}>Moves</h2>
          <p className="muted glyphs">
            {GRADE_ORDER.filter((g) => GRADE_GLYPH[g]).map((g) => (
              <span key={g} title={GRADE_LABEL[g]}>
                <span className={`grade ${g}`}>{GRADE_GLYPH[g]}</span>
                {GRADE_GLYPH[g] !== GRADE_LABEL[g] ? ` ${GRADE_LABEL[g]}` : ""}
              </span>
            ))}
          </p>
          {tab === "setup" ? (
            <p className="muted">Set the position, then Play from here. Moves after that are the game you analyze.</p>
          ) : (
            <>
          {analysis && (
            <div className="row" style={{ margin: "8px 0", flexWrap: "wrap" }}>
              {GRADE_ORDER.filter((g) => counts[g]).map((g) => (
                <button key={g} className={`btn grade ${g}`} onClick={() => jumpGrade(g)} title={GRADE_LABEL[g]}>
                  {counts[g]} {GRADE_LABEL[g]}
                </button>
              ))}
            </div>
          )}
          <div className={`moves${analysis ? " scored" : ""}`}>
            {Array.from({ length: Math.ceil(sans.length / 2) }, (_, i) => {
              const w = sans[i * 2];
              const b = sans[i * 2 + 1];
              const wg = analysis?.moves[i * 2];
              const bg = analysis?.moves[i * 2 + 1];
              const prevW = analysis?.moves[i * 2 - 1];
              const prevB = wg;
              return (
                <span key={i} style={{ display: "contents" }}>
                  <span className="muted">{i + 1}.</span>
                  <button
                    className={ply === i * 2 + 1 ? "on" : ""}
                    title={wg ? GRADE_LABEL[wg.grade] : undefined}
                    onClick={() => goPly(i * 2 + 1, true)}
                  >
                    {w} {wg && GRADE_GLYPH[wg.grade] ? <span className={`grade ${wg.grade}`}>{GRADE_GLYPH[wg.grade]}</span> : null}
                  </button>
                  {analysis ? movePts(wg, prevW) : null}
                  <button
                    className={ply === i * 2 + 2 ? "on" : ""}
                    title={bg ? GRADE_LABEL[bg.grade] : undefined}
                    onClick={() => goPly(i * 2 + 2, true)}
                    disabled={!b}
                  >
                    {b} {bg && GRADE_GLYPH[bg.grade] ? <span className={`grade ${bg.grade}`}>{GRADE_GLYPH[bg.grade]}</span> : null}
                  </button>
                  {analysis ? movePts(bg, prevB) : null}
                </span>
              );
            })}
          </div>
            </>
          )}
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
              <button className="btn btn-primary" onClick={() => void runFull()} disabled={!!busy || (sans.length === 0 && !pgn)}>
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
          {tab === "setup" ? (
            <p className="muted">This is one position, so there is no game accuracy. The best move is above.</p>
          ) : analysis ? (
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
          {tab === "setup" ? (
            <p className="muted">Grades show up after you analyze a played game.</p>
          ) : analysis ? (
            <div className="row" style={{ flexWrap: "wrap" }}>
              {GRADE_ORDER.filter((g) => counts[g]).map((g) => (
                <button key={g} className={`btn grade ${g}`} title={GRADE_LABEL[g]} onClick={() => jumpGrade(g)}>
                  {counts[g]} {GRADE_LABEL[g]}
                </button>
              ))}
            </div>
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
      <dialog ref={askRef} className="ask" onClose={() => setAsk(null)}>
        <h2>How do you want to analyze?</h2>
        <p className="muted">
          {ask ? `${ask.white} vs ${ask.black} ${ask.result}` : ""}
        </p>
        <p className="muted" style={{ marginTop: 8 }}>
          Full game analysis grades every move. Manual lets you step through and see Stockfish’s suggestion on the position you are on.
        </p>
        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn btn-primary" onClick={() => startImported("full")}>
            Full game analysis
          </button>
          <button className="btn" onClick={() => startImported("manual")}>
            Manual analysis
          </button>
          <button className="btn" onClick={() => setAsk(null)}>
            Cancel
          </button>
        </div>
      </dialog>
    </>
  );
}
