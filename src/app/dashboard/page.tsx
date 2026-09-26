"use client";

import { SKILL_LABEL, skillScores } from "@/lib/dashboard";
import { useProfile } from "@/lib/store";

export default function Page() {
  const profile = useProfile();
  if (profile.plan !== "coach") {
    return (
      <>
        <h1 className="page-title">Dashboard</h1>
        <p className="lede">Five skill scores rebuild every time you save a full analysis. Coach plan.</p>
        <a className="btn btn-primary" href="/pricing">
          See pricing
        </a>
      </>
    );
  }
  const scores = skillScores(profile.analyses);
  return (
    <>
      <h1 className="page-title">Dashboard</h1>
      <p className="lede">
        {profile.analyses.length} saved game{profile.analyses.length === 1 ? "" : "s"}. Scores vs your own history, not a global pool.
      </p>
      <div className="panel">
        {(Object.keys(scores) as Array<keyof typeof scores>).map((k) => (
          <div className="skill" key={k}>
            <span style={{ width: 120 }}>{SKILL_LABEL[k]}</span>
            <div className="bar">
              <i style={{ width: `${scores[k]}%` }} />
            </div>
            <span>{scores[k].toFixed(0)}</span>
          </div>
        ))}
      </div>
      <div className="cards" style={{ marginTop: 16 }}>
        {profile.analyses.slice(0, 8).map((a) => (
          <div className="card" key={a.id}>
            <h3>
              {a.white} vs {a.black}
            </h3>
            <p className="muted">{a.opening ?? "—"}</p>
            <p>
              {a.whiteAccuracy.toFixed(0)} / {a.blackAccuracy.toFixed(0)} · {a.result}
            </p>
          </div>
        ))}
      </div>
    </>
  );
}
