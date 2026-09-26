"use client";

import { PuzzleBoard } from "@/components/PuzzleBoard";

export default function Page() {
  return (
    <>
      <h1 className="page-title">Spot the trap</h1>
      <p className="lede">Hanging and trapped pieces. See it before you play it.</p>
      <PuzzleBoard angle="hangingPiece" />
    </>
  );
}
