"use client";

import { PuzzleBoard } from "@/components/PuzzleBoard";

export default function Page() {
  return (
    <>
      <h1 className="page-title">Puzzles</h1>
        <p className="lede">Rating-adaptive tactics from Lichess. Sign in to keep your rating.</p>
      <PuzzleBoard />
    </>
  );
}
