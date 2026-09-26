"use client";

import { Chess } from "chess.js";
import { use, useEffect, useRef, useState } from "react";
import { Board } from "@/components/Board";
import { OPENINGS } from "@/lib/openings";
import { patchProfile, useProfile } from "@/lib/store";

function startPly(color: "white" | "black"): number {
  return color === "white" ? 0 : 1;
}

function fenAt(moves: string[], ply: number): string {
  const g = new Chess();
  for (let i = 0; i < ply; i++) g.move(moves[i]);
  return g.fen();
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const opening = OPENINGS.find((o) => o.id === id);
  const profile = useProfile();
  const saved = profile.openings[id];
  const [ch, setCh] = useState(saved?.ch ?? 0);
  const [ply, setPly] = useState(saved?.ply ?? startPly(opening?.color ?? "white"));
  const [msg, setMsg] = useState("Play the book move.");
  const restored = useRef(!!saved);

  useEffect(() => {
    if (restored.current || !saved) return;
    restored.current = true;
    setCh(saved.ch);
    setPly(saved.ply);
  }, [saved]);

  useEffect(() => {
    if (!opening) return;
    patchProfile((p) => ({ ...p, openings: { ...p.openings, [id]: { ch, ply } } }));
  }, [id, ch, ply, opening]);

  if (!opening) return <p>Unknown opening.</p>;
  const chapter = opening.chapters[ch];
  if (!chapter) return <p>Unknown opening.</p>;

  const userIsWhite = opening.color === "white";
  const userToMove = (ply % 2 === 0) === userIsWhite;
  const fen = fenAt(chapter.moves, ply);

  const reset = (idx = ch) => {
    setCh(idx);
    setPly(startPly(opening.color));
    setMsg("Play the book move.");
  };

  const onDrop = (from: string, to: string, promotion?: "q" | "r" | "b" | "n") => {
    if (!userToMove) return false;
    const g = new Chess(fen);
    const mv = g.move({ from, to, promotion: promotion ?? "q" });
    if (!mv) return false;
    if (mv.san !== chapter.moves[ply]) {
      setMsg(`Not ${chapter.moves[ply]}.`);
      return false;
    }
    let next = ply + 1;
    if (chapter.moves[next]) next += 1;
    setPly(next);
    setMsg(next >= chapter.moves.length ? "Chapter done." : "Good.");
    return true;
  };

  return (
    <>
      <h1 className="page-title">{opening.name}</h1>
      <p className="lede">{opening.blurb}</p>
      <div className="row" style={{ marginBottom: 8 }}>
        {opening.chapters.map((c, i) => (
          <button key={c.name} className={`btn ${i === ch ? "btn-primary" : ""}`} onClick={() => reset(i)}>
            {c.name}
          </button>
        ))}
        <button className="btn" onClick={() => reset()}>
          Reset
        </button>
      </div>
      <Board fen={fen} flipped={!userIsWhite} onDrop={onDrop} />
      <p style={{ marginTop: 8 }}>
        {msg} {ply}/{chapter.moves.length}
      </p>
    </>
  );
}
