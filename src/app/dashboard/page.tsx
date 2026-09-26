"use client";

import { SKILL_LABEL, skillScores } from "@/lib/dashboard";
import { patchProfile, useProfile } from "@/lib/store";

export default function Page() {
  const profile = useProfile();
  const scores = skillScores(profile.analyses);
  return (
    <>
      <h1 className="page-title">Dashboard</h1>
      <p className="lede">Rating, games, and analyses. Sign in and they follow you to the next device.</p>
      <div className="panel" style={{ maxWidth: 420, marginBottom: 16 }}>
        <div className="stat">
          <span>Puzzle rating</span>
          <span>{profile.puzzleRating}</span>
        </div>
        <div className="stat">
          <span>Solved / failed</span>
          <span>
            {profile.solved} / {profile.failed}
          </span>
        </div>
        <div className="stat">
          <span>Streak</span>
          <span>
            {profile.streak} (best {profile.bestStreak})
          </span>
        </div>
        <div className="stat">
          <span>Coordinates best</span>
          <span>{profile.coordBest}</span>
        </div>
        <label className="stat">
          <span>Chess.com</span>
          <input
            type="text"
            value={profile.chessCom}
            placeholder="username"
            onChange={(e) => patchProfile((p) => ({ ...p, chessCom: e.target.value.trim().toLowerCase().slice(0, 64) }))}
            style={{ width: 140 }}
          />
        </label>
        <label className="stat">
          <span>Lichess</span>
          <input
            type="text"
            value={profile.lichess}
            placeholder="username"
            onChange={(e) => patchProfile((p) => ({ ...p, lichess: e.target.value.trim().toLowerCase().slice(0, 64) }))}
            style={{ width: 140 }}
          />
        </label>
      </div>
      {profile.plan === "coach" ? (
        <div className="panel" style={{ marginBottom: 16 }}>
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
      ) : (
        <p className="muted" style={{ marginBottom: 16 }}>
          Skill scores from full analyses need the Coach plan.{" "}
          <a href="/pricing">See pricing</a>
        </p>
      )}
      {profile.games.length ? (
        <>
          <h2>Recent games</h2>
          <div className="cards" style={{ marginTop: 8, marginBottom: 16 }}>
            {profile.games.slice(0, 8).map((g) => (
              <div className="card" key={g.id}>
                <h3>
                  {g.kind === "coach" ? "Coach" : "Play"} vs {g.opp}
                </h3>
                <p className="muted">{new Date(g.at).toLocaleString()}</p>
                <p>{g.result}</p>
              </div>
            ))}
          </div>
        </>
      ) : null}
      {profile.analyses.length ? (
        <>
          <h2>Saved analyses</h2>
          <div className="cards" style={{ marginTop: 8 }}>
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
      ) : null}
    </>
  );
}
