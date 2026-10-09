"use client";

import { Chess } from "chess.js";
import { useEffect, useState } from "react";
import { fetchPuzzle, puzzleStart, type LichessPuzzle } from "@/lib/api";
import { useProfile } from "@/lib/store";
import { Board } from "@/components/Board";

type Item = LichessPuzzle & { clean: number };

export default function Page() {
  const [set, setSet] = useState<Item[]>([]);
  const [i, setI] = useState(0);
  const [fen, setFen] = useState(new Chess().fen());
  const [step, setStep] = useState(0);
  const [msg, setMsg] = useState("");
  const extra = useProfile().plan !== "free";
  const n = extra ? 8 : 5;

  const build = async () => {
    try {
      const items: Item[] = [];
      for (let k = 0; k < n; k++) {
        const p = await fetchPuzzle();
        items.push({ ...p, clean: 0 });
      }
      setSet(items);
      setI(0);
      setFen(puzzleStart(items[0]).fen);
      setStep(0);
      setMsg("Hit each puzzle clean twice.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not load set.");
    }
  };

  useEffect(() => {
    let gone = false;
    (async () => {
      try {
        const items: Item[] = [];
        for (let k = 0; k < n; k++) {
          const p = await fetchPuzzle();
          items.push({ ...p, clean: 0 });
        }
        if (gone || !items[0]) return;
        setSet(items);
        setI(0);
        setFen(puzzleStart(items[0]).fen);
        setStep(0);
        setMsg("Hit each puzzle clean twice.");
      } catch (e) {
        if (!gone) setMsg(e instanceof Error ? e.message : "Could not load set.");
      }
    })();
    return () => {
      gone = true;
    };
  }, [n]);

  const cur = set[i];
  const play = (from: string, to: string, promotion?: "q" | "r" | "b" | "n") => {
    if (!cur) return false;
    const need = cur.solution[step];
    const uci = `${from}${to}${promotion ?? ""}`;
    if (uci !== need && `${from}${to}` !== need) {
      setMsg("Miss — reset this one.");
      setSet((xs) => xs.map((x, idx) => (idx === i ? { ...x, clean: 0 } : x)));
      setFen(puzzleStart(cur).fen);
      setStep(0);
      return false;
    }
    const g = new Chess(fen);
    g.move({ from, to, promotion: promotion ?? "q" });
    let next = step + 1;
    if (cur.solution[next]) {
      const r = cur.solution[next];
      g.move({ from: r.slice(0, 2), to: r.slice(2, 4), promotion: (r[4] as "q") || "q" });
      next += 1;
    }
    setFen(g.fen());
    setStep(next);
    if (next >= cur.solution.length) {
      const updated = set.map((x, idx) => (idx === i ? { ...x, clean: x.clean + 1 } : x));
      setSet(updated);
      if (updated.every((x) => x.clean >= 2)) {
        setMsg("Set complete.");
        return true;
      }
      const nextI = updated.findIndex((x, idx) => idx > i && x.clean < 2);
      const j = nextI === -1 ? updated.findIndex((x) => x.clean < 2) : nextI;
      setI(j);
      setFen(puzzleStart(updated[j]).fen);
      setStep(0);
      setMsg(`Clean. Puzzle ${j + 1}/${updated.length}.`);
    }
    return true;
  };

  return (
    <>
      <h1 className="page-title">Second Nature</h1>
      <p className="lede">Woodpecker: a small set, repeated until it is boring. {extra ? "Extended set." : "Standard set — Premium unlocks more."}</p>
      <div className="row" style={{ marginBottom: 8 }}>
        <button className="btn" onClick={build}>
          New set
        </button>
        <span className="muted">
          {set.map((x, idx) => `${idx + 1}:${x.clean}/2`).join("  ")}
        </span>
      </div>
      {cur && <Board fen={fen} flipped={new Chess(fen).turn() === "b"} onDrop={play} />}
      <p style={{ marginTop: 8 }}>{msg}</p>
    </>
  );
}
