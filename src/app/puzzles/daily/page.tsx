"use client";

import { PuzzleBoard } from "@/components/PuzzleBoard";

export default function Page() {
  return (
    <>
      <h1 className="page-title">Daily puzzle</h1>
      <p className="lede">Today&apos;s Lichess puzzle.</p>
      <PuzzleBoard daily />
    </>
  );
}
