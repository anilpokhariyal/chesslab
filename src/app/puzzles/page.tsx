"use client";

import { PuzzleBoard } from "@/components/PuzzleBoard";

export default function Page() {
  return (
    <>
      <h1 className="page-title">Puzzles</h1>
      <p className="lede">Rating-adaptive tactics from Lichess. Your score lives in this browser.</p>
      <PuzzleBoard />
    </>
  );
}
