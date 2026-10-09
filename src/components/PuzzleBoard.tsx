"use client";

import { Chess } from "chess.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchDailyPuzzle, fetchPuzzle, puzzleStart, type LichessPuzzle } from "@/lib/api";
import { loadProfile, patchProfile, updateRating } from "@/lib/store";
import { Board } from "./Board";

const PIECE: Record<string, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };

export function PuzzleBoard({
  angle,
  daily,
  timed,
  onSolved,
}: {
  angle?: string;
  daily?: boolean;
  timed?: number;
  onSolved?: (ok: boolean) => void;
}) {
  const [puzzle, setPuzzle] = useState<LichessPuzzle | null>(null);
  const [fen, setFen] = useState(new Chess().fen());
  const [step, setStep] = useState(0);
  const [msg, setMsg] = useState("Find the best move.");
  const [hints, setHints] = useState(0);
  const [left, setLeft] = useState(timed ?? 0);
  const [err, setErr] = useState("");
  const [miss, setMiss] = useState<string | null>(null);
  const [bad, setBad] = useState<string | null>(null);
  const [glow, setGlow] = useState<string[]>([]);
  const done = useRef(false);
  const replay = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const finish = useCallback(
    (ok: boolean) => {
      if (done.current) return;
      done.current = true;
      const prof = loadProfile();
      const next = updateRating(prof.puzzleRating, puzzle?.rating ?? 1500, ok);
      patchProfile((p) => ({
        ...p,
        puzzleRating: next,
        streak: ok ? p.streak + 1 : 0,
        bestStreak: ok ? Math.max(p.bestStreak, p.streak + 1) : p.bestStreak,
        solved: p.solved + (ok ? 1 : 0),
        failed: p.failed + (ok ? 0 : 1),
      }));
      onSolved?.(ok);
    },
    [onSolved, puzzle?.rating],
  );

  const load = useCallback(async () => {
    clearTimeout(replay.current);
    done.current = true;
    setErr("");
    setMsg("Find the best move.");
    setStep(0);
    setHints(0);
    try {
      const p = daily ? await fetchDailyPuzzle() : await fetchPuzzle(angle);
      setPuzzle(p);
      setFen(puzzleStart(p).fen);
      setMiss(null);
      setBad(null);
      setGlow([]);
      setLeft(timed ?? 0);
      done.current = false;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load puzzle");
    }
  }, [angle, daily, timed]);

  useEffect(() => {
    let gone = false;
    clearTimeout(replay.current);
    (async () => {
      try {
        const p = daily ? await fetchDailyPuzzle() : await fetchPuzzle(angle);
        if (gone) return;
        done.current = false;
        setPuzzle(p);
        setFen(puzzleStart(p).fen);
        setMiss(null);
        setBad(null);
        setGlow([]);
        setStep(0);
        setHints(0);
        setMsg("Find the best move.");
        setLeft(timed ?? 0);
        setErr("");
      } catch (e) {
        if (!gone) setErr(e instanceof Error ? e.message : "Could not load puzzle");
      }
    })();
    return () => {
      gone = true;
    };
  }, [angle, daily, timed]);

  useEffect(() => {
    if (!timed || !puzzle) return;
    const tick = setInterval(() => setLeft((n) => n - 1), 1000);
    const expire = setTimeout(() => {
      if (done.current) return;
      setMsg("Time.");
      finish(false);
      void load();
    }, timed * 1000);
    return () => {
      clearInterval(tick);
      clearTimeout(expire);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restart timer per puzzle id
  }, [timed, puzzle?.id, finish, load]);

  const turn = useMemo(() => new Chess(fen).turn(), [fen]);

  const playUci = (from: string, to: string, promotion?: "q" | "r" | "b" | "n") => {
    if (!puzzle || done.current || miss) return false;
    const g = new Chess(fen);
    let mv;
    try {
      mv = g.move({ from, to, promotion: promotion ?? "q" });
    } catch {
      return false;
    }
    if (!mv) return false;
    const need = puzzle.solution[step];
    const played = `${from}${to}${mv.promotion ?? ""}`;
    if (played !== need && `${from}${to}` !== need) {
      setMiss(g.fen());
      setBad(to);
      setGlow([]);
      setMsg(
        from === need.slice(0, 2)
          ? `${mv.san} is the right piece, but not the right square.`
          : `${mv.san} does not work. The ${PIECE[mv.piece] ?? "piece"} on ${from} is the wrong piece.`,
      );
      return true;
    }
    let nextFen = g.fen();
    let nextStep = step + 1;
    if (puzzle.solution[nextStep]) {
      const reply = puzzle.solution[nextStep];
      g.move({
        from: reply.slice(0, 2),
        to: reply.slice(2, 4),
        ...(reply[4] ? { promotion: reply[4] as "q" | "r" | "b" | "n" } : {}),
      });
      nextFen = g.fen();
      nextStep += 1;
    }
    setFen(nextFen);
    setStep(nextStep);
    setBad(null);
    setGlow([]);
    if (nextStep >= puzzle.solution.length) {
      setMsg("Solved.");
      finish(true);
    } else setMsg("Keep going.");
    return true;
  };

  const hint = () => {
    if (!puzzle || done.current) return;
    setMiss(null);
    setBad(null);
    setHints((h) => h + 1);
    setGlow([puzzle.solution[step].slice(0, 2)]);
    setMsg("Move the highlighted piece.");
  };

  const show = () => {
    if (!puzzle) return;
    clearTimeout(replay.current);
    if (!done.current) finish(false);
    setMiss(null);
    setBad(null);
    setGlow([]);
    const g = new Chess(puzzleStart(puzzle).fen);
    const moves = puzzle.solution;
    setFen(g.fen());
    setStep(0);
    setMsg("");
    let i = 0;
    const tick = () => {
      const u = moves[i];
      if (!u) {
        setGlow([]);
        setMsg("That's the line.");
        return;
      }
      const from = u.slice(0, 2);
      const to = u.slice(2, 4);
      try {
        const mv = g.move({
          from,
          to,
          ...(u[4] ? { promotion: u[4] as "q" | "r" | "b" | "n" } : {}),
        });
        setFen(g.fen());
        setGlow([from, to]);
        setStep(i + 1);
        setMsg(mv.san);
      } catch {
        setMsg("That's the line.");
        return;
      }
      i += 1;
      replay.current = setTimeout(tick, 800);
    };
    replay.current = setTimeout(tick, 400);
  };

  useEffect(() => () => clearTimeout(replay.current), []);

  return (
    <div>
      <div className="row" style={{ marginBottom: 8 }}>
        <span>Rating {puzzle?.rating ?? "—"}</span>
        {timed ? <span>{left}s</span> : null}
        {miss && (
          <button
            className="btn"
            onClick={() => {
              setMiss(null);
              setBad(null);
              setMsg("Find the best move.");
            }}
          >
            Try again
          </button>
        )}
        <button className="btn" onClick={() => void load()}>
          Next
        </button>
        <button className="btn" onClick={hint}>
          Hint ({hints})
        </button>
        <button className="btn" onClick={show}>
          Solution
        </button>
      </div>
      {err && <p className="grade blunder">{err}</p>}
      <p className={`turn-banner ${turn}`}>{turn === "w" ? "White" : "Black"} to move</p>
      <Board
        fen={miss ?? fen}
        flipped={turn === "b"}
        onDrop={playUci}
        allowDrag={!miss}
        squareStyles={{
          ...Object.fromEntries(glow.map((sq) => [sq, { backgroundColor: "#f5d76e" }])),
          ...(bad ? { [bad]: { boxShadow: "inset 0 0 0 4px #e85d4c" } } : {}),
        }}
      />
      <p className={miss ? "turn-why" : ""} style={{ marginTop: 8 }}>{msg}</p>
    </div>
  );
}
