"use client";

import { patchProfile, useProfile } from "@/lib/store";
import type { Plan } from "@/lib/types";
import { THEMES, themeById } from "@/lib/themes";

const PLANS: { id: Plan; name: string; price: string; points: string[] }[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    points: ["Unlimited local Stockfish reviews", "Chess.com & Lichess import", "Depth 12", "Puzzles & bots"],
  },
  {
    id: "premium",
    name: "Premium",
    price: "$5/mo",
    points: ["Depth 25", "Saved analysis history", "Board themes", "Extended Second Nature sets"],
  },
  {
    id: "coach",
    name: "Coach",
    price: "$8/mo",
    points: ["Everything in Premium", "Coach explanations", "Skill dashboard", "Chat about your games"],
  },
];

export default function Page() {
  const profile = useProfile();
  const plan = profile.plan;
  const theme = profile.theme;

  const pick = (id: Plan) => {
    // ponytail: local plan flag; Stripe Checkout when you have keys
    patchProfile((x) => ({ ...x, plan: id }));
  };

  return (
    <>
      <h1 className="page-title">Pricing</h1>
      <p className="lede">Analysis stays free. Premium goes deeper. Coach talks through the game. No Stripe yet — the button sets your local plan.</p>
      <div className="cards">
        {PLANS.map((p) => (
          <div className="card" key={p.id}>
            <h3>{p.name}</h3>
            <div className="price">{p.price}</div>
            <ul className="muted">
              {p.points.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <button className={`btn ${plan === p.id ? "btn-primary" : ""}`} onClick={() => pick(p.id)}>
              {plan === p.id ? "Current" : "Use this plan"}
            </button>
          </div>
        ))}
      </div>
      <h2 style={{ margin: "24px 0 8px" }}>Board themes</h2>
      <div className="row">
        {THEMES.map((t) => {
          const locked = t.premium && plan === "free";
          return (
            <button
              key={t.id}
              className={`btn ${theme === t.id ? "btn-primary" : ""}`}
              disabled={locked}
              onClick={() => {
                patchProfile((x) => ({ ...x, theme: t.id }));
              }}
            >
              {t.name}
              {locked ? " (Premium)" : ""}
            </button>
          );
        })}
      </div>
      <p className="muted" style={{ marginTop: 8 }}>
        Preview: {themeById(theme).name}
      </p>
    </>
  );
}
