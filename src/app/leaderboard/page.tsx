"use client";

import { useProfile } from "@/lib/store";

export default function Page() {
  const p = useProfile();
  return (
    <>
      <h1 className="page-title">Puzzle stats</h1>
      <p className="lede">Your puzzle growth. Sign in and it stays on your account.</p>
      <div className="panel" style={{ maxWidth: 420 }}>
        <div className="stat">
          <span>Name</span>
          <span>{p.name || "Anonymous"}</span>
        </div>
        <div className="stat">
          <span>Puzzle rating</span>
          <span>{p.puzzleRating}</span>
        </div>
        <div className="stat">
          <span>Solved</span>
          <span>{p.solved}</span>
        </div>
        <div className="stat">
          <span>Failed</span>
          <span>{p.failed}</span>
        </div>
        <div className="stat">
          <span>Streak</span>
          <span>{p.streak}</span>
        </div>
        <div className="stat">
          <span>Best streak</span>
          <span>{p.bestStreak}</span>
        </div>
      </div>
    </>
  );
}
