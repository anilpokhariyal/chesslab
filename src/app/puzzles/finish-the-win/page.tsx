"use client";

import { PuzzleBoard } from "@/components/PuzzleBoard";

export default function Page() {
  return (
    <>
      <h1 className="page-title">Finish the win</h1>
      <p className="lede">Convert mates and winning tactics.</p>
      <PuzzleBoard angle="mate" />
    </>
  );
}
