"use client";

import Link from "next/link";
import { GRADE_GLYPH, GRADE_LABEL, GRADE_ORDER, type Grade } from "@/lib/classify";
import { SKILL_LABEL, skillScores } from "@/lib/dashboard";
import { patchProfile, useProfile } from "@/lib/store";

const GO = [
  { href: "/", label: "Analyze" },
  { href: "/coach", label: "Coach" },
  { href: "/play", label: "Play" },
  { href: "/puzzles", label: "Puzzles" },
  { href: "/openings", label: "Openings" },
  { href: "/coordinates", label: "Coordinates" },
] as const;

function tally(moves: { grade: Grade }[]): Record<Grade, number> {
  const n = Object.fromEntries(GRADE_ORDER.map((g) => [g, 0])) as Record<Grade, number>;
  for (const m of moves) n[m.grade]++;
  return n;
}

function barColor(n: number): string {
  return n < 40 ? "var(--danger)" : n < 60 ? "var(--warn)" : "var(--accent)";
}

export default function Page() {
  const profile = useProfile();
  const scores = skillScores(profile.analyses);
  const mix = tally(profile.analyses.flatMap((a) => a.moves));
  const handle = (profile.chessCom || profile.lichess).toLowerCase();

  return (
    <>
      <h1 className="page-title">Dashboard</h1>
      <p className="lede">Rating, games, and analyses. Sign in and they follow you to the next device.</p>

      <div className="tiles" style={{ marginBottom: 16 }}>
        <div className="tile">
          <span>Puzzle rating</span>
          <b>{profile.puzzleRating}</b>
        </div>
        <div className="tile">
          <span>Solved / failed</span>
          <b>
            {profile.solved} / {profile.failed}
          </b>
        </div>
        <div className="tile">
          <span>Streak · best</span>
          <b>
            {profile.streak} · {profile.bestStreak}
          </b>
        </div>
        <div className="tile">
          <span>Coordinates</span>
          <b>{profile.coordBest}</b>
        </div>
        <div className="tile">
          <span>Games</span>
          <b>{profile.games.length}</b>
        </div>
        <div className="tile">
          <span>Analyses</span>
          <b>{profile.analyses.length}</b>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 16 }}>
        <section className="panel">
          <h2>Skills</h2>
          {profile.analyses.length === 0 ? (
            <p className="muted">Analyze a game and these bars fill in from your moves.</p>
          ) : (
            <p className="muted">From {profile.analyses.length} saved {profile.analyses.length === 1 ? "analysis" : "analyses"}.</p>
          )}
          {(Object.keys(scores) as Array<keyof typeof scores>).map((k) => (
            <div className="skill" key={k}>
              <span style={{ width: 120 }}>{SKILL_LABEL[k]}</span>
              <div className="bar">
                <i style={{ width: `${scores[k]}%`, background: barColor(scores[k]) }} />
              </div>
              <span>{scores[k].toFixed(0)}</span>
            </div>
          ))}
          {profile.analyses.length > 0 && (
            <p className="glyphs" style={{ marginTop: 12 }}>
              {GRADE_ORDER.filter((g) => mix[g]).map((g) => (
                <span key={g} className={`grade ${g}`}>
                  {GRADE_GLYPH[g] || GRADE_LABEL[g]} {mix[g]}
                </span>
              ))}
            </p>
          )}
        </section>
        <section className="panel">
          <h2>Accounts</h2>
          <label className="stat">
            <span>Chess.com</span>
            <input
              type="text"
              value={profile.chessCom}
              placeholder="username"
              onChange={(e) => patchProfile((p) => ({ ...p, chessCom: e.target.value.trim().toLowerCase().slice(0, 64) }))}
              style={{ width: 160 }}
            />
          </label>
          <label className="stat">
            <span>Lichess</span>
            <input
              type="text"
              value={profile.lichess}
              placeholder="username"
              onChange={(e) => patchProfile((p) => ({ ...p, lichess: e.target.value.trim().toLowerCase().slice(0, 64) }))}
              style={{ width: 160 }}
            />
          </label>
          <p className="muted" style={{ margin: "12px 0 8px" }}>
            Plan: {profile.plan === "free" ? "Free" : profile.plan === "premium" ? "Premium" : "Coach"}
          </p>
          <h2>Jump in</h2>
          <div className="row">
            {GO.map((x) => (
              <Link key={x.href} className={`btn${x.href === "/" ? " btn-primary" : ""}`} href={x.href}>
                {x.label}
              </Link>
            ))}
          </div>
        </section>
      </div>

      <h2>Recent games</h2>
      <div className="cards" style={{ marginTop: 8, marginBottom: 16 }}>
        {profile.games.length === 0 && (
          <div className="card">
            <h3>No games yet</h3>
            <p className="muted">Play a bot or sit with the coach.</p>
            <div className="row">
              <Link className="btn btn-primary" href="/play">
                Play
              </Link>
              <Link className="btn" href="/coach">
                Coach
              </Link>
            </div>
          </div>
        )}
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

      <h2>Saved analyses</h2>
      <div className="cards" style={{ marginTop: 8 }}>
        {profile.analyses.length === 0 && (
          <div className="card">
            <h3>No analyses yet</h3>
            <p className="muted">Import a Chess.com or Lichess game and run a full review.</p>
            <Link className="btn btn-primary" href="/">
              Analyze
            </Link>
          </div>
        )}
        {profile.analyses.slice(0, 8).map((a) => {
          const g = tally(a.moves);
          const mine =
            handle && a.white.toLowerCase() === handle
              ? a.whiteAccuracy
              : handle && a.black.toLowerCase() === handle
                ? a.blackAccuracy
                : null;
          return (
            <div className="card" key={a.id}>
              <h3>
                {a.white} vs {a.black}
              </h3>
              <p className="muted">{a.opening ?? "—"}</p>
              <p>
                {a.whiteAccuracy.toFixed(0)} / {a.blackAccuracy.toFixed(0)} · {a.result}
                {mine != null ? ` · you ${mine.toFixed(0)}` : ""}
              </p>
              <p className="glyphs">
                {(["brilliant", "best", "inaccuracy", "mistake", "blunder"] as Grade[]).map(
                  (k) =>
                    g[k] > 0 && (
                      <span key={k} className={`grade ${k}`}>
                        {GRADE_GLYPH[k] || k} {g[k]}
                      </span>
                    ),
                )}
              </p>
            </div>
          );
        })}
      </div>
    </>
  );
}
