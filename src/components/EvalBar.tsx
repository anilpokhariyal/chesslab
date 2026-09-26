"use client";

import type { Score } from "@/lib/types";
import { formatScore, scoreToWhiteCp } from "@/lib/engine";

export function EvalBar({ score, flipped }: { score?: Score; flipped?: boolean }) {
  const cp = score ? scoreToWhiteCp(score) : 0;
  const clamped = Math.max(-800, Math.min(800, cp));
  const whitePct = 50 + (clamped / 800) * 50;
  return (
    <div className="eval-bar" style={{ transform: flipped ? "rotate(180deg)" : undefined }}>
      <div className="white" style={{ height: `${whitePct}%` }} />
      <div className="label" style={{ transform: flipped ? "rotate(180deg)" : undefined }}>
        {score ? formatScore(score) : "0.00"}
      </div>
    </div>
  );
}
