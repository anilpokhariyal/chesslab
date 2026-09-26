"use client";

import { Chess } from "chess.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchDailyPuzzle, fetchPuzzle, type LichessPuzzle } from "@/lib/api";
import { loadProfile, patchProfile, updateRating } from "@/lib/store";
import { Board } from "./Board";

function startPuzzle(p: LichessPuzzle): { fen: string; color: "w" | "b" } {
  const g = new Chess();
  g.loadPgn(p.pgn);
  const all = g.history();
  const replay = new Chess();
  const to = Math.min(p.initialPly, all.length);
  for (let i = 0; i < to; i++) replay.move(all[i]);
  return { fen: replay.fen(), color: replay.turn() };
}

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
  const done = useRef(false);

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
    done.current = true;
    setErr("");
    setMsg("Find the best move.");
    setStep(0);
    setHints(0);
    try {
      const p = daily ? await fetchDailyPuzzle() : await fetchPuzzle(angle);
      setPuzzle(p);
      setFen(startPuzzle(p).fen);
      setLeft(timed ?? 0);
      done.current = false;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load puzzle");
    }
  }, [angle, daily, timed]);

  useEffect(() => {
    let gone = false;
    (async () => {
      try {
        const p = daily ? await fetchDailyPuzzle() : await fetchPuzzle(angle);
        if (gone) return;
        done.current = false;
        setPuzzle(p);
        setFen(startPuzzle(p).fen);
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

  const color = useMemo(() => new Chess(fen).turn(), [fen]);

  const playUci = (from: string, to: string, promotion?: "q" | "r" | "b" | "n") => {
    if (!puzzle || done.current) return false;
    const need = puzzle.solution[step];
    const uci = `${from}${to}${promotion ?? ""}`;
    if (uci !== need && `${from}${to}` !== need) {
      setMsg("Not it. Try again.");
      return false;
    }
    const g = new Chess(fen);
    const mv = g.move({ from, to, promotion: promotion ?? "q" });
    if (!mv) return false;
    let nextFen = g.fen();
    let nextStep = step + 1;
    if (puzzle.solution[nextStep]) {
      const reply = puzzle.solution[nextStep];
      g.move({ from: reply.slice(0, 2), to: reply.slice(2, 4), promotion: (reply[4] as "q") || "q" });
      nextFen = g.fen();
      nextStep += 1;
    }
    setFen(nextFen);
    setStep(nextStep);
    if (nextStep >= puzzle.solution.length) {
      setMsg("Solved.");
      finish(true);
    } else setMsg("Keep going.");
    return true;
  };

  const hint = () => {
    if (!puzzle || done.current) return;
    setHints((h) => h + 1);
    const u = puzzle.solution[step];
    setMsg(`Hint: ${u.slice(0, 2)} → …`);
  };

  const show = () => {
    if (!puzzle || done.current) return;
    const g = new Chess(fen);
    const u = puzzle.solution[step];
    try {
      g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: (u[4] as "q") || "q" });
      setFen(g.fen());
    } catch {
      /* */
    }
    setMsg(`Solution: ${puzzle.solution.join(" ")}`);
    finish(false);
  };

  return (
    <div>
      <div className="row" style={{ marginBottom: 8 }}>
        <span>Rating {puzzle?.rating ?? "—"}</span>
        <span className="muted">{color === "w" ? "White" : "Black"} to move</span>
        {timed ? <span>{left}s</span> : null}
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
      <Board fen={fen} flipped={color === "b"} onDrop={playUci} />
      <p style={{ marginTop: 8 }}>{msg}</p>
    </div>
  );
}
