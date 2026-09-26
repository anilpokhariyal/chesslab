"use client";

import { PuzzleBoard } from "@/components/PuzzleBoard";

export default function Page() {
  return (
    <>
      <h1 className="page-title">Rushed moves</h1>
      <p className="lede">Thirty seconds. Play the tactic before the clock does.</p>
      <PuzzleBoard timed={30} />
    </>
  );
}
