"use client";

import Link from "next/link";
import { useState } from "react";
import { OPENINGS } from "@/lib/openings";

export default function Page() {
  const [color, setColor] = useState<"all" | "white" | "black">("all");
  const [level, setLevel] = useState<"all" | "beginner" | "intermediate" | "advanced">("all");
  const [q, setQ] = useState("");
  const list = OPENINGS.filter(
    (o) =>
      (color === "all" || o.color === color) &&
      (level === "all" || o.level === level) &&
      o.name.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <>
      <h1 className="page-title">Opening trainer</h1>
      <p className="lede">Play the book move. Wrong move snaps back.</p>
      <div className="row" style={{ marginBottom: 12 }}>
        <input type="text" placeholder="Search openings…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 240 }} />
        {(["all", "white", "black"] as const).map((c) => (
          <button key={c} className={`btn ${color === c ? "btn-primary" : ""}`} onClick={() => setColor(c)}>
            {c}
          </button>
        ))}
        {(["all", "beginner", "intermediate", "advanced"] as const).map((l) => (
          <button key={l} className={`btn ${level === l ? "btn-primary" : ""}`} onClick={() => setLevel(l)}>
            {l}
          </button>
        ))}
      </div>
      <div className="cards">
        {list.map((o) => (
          <Link key={o.id} href={`/openings/${o.id}`} className="card">
            <h3>{o.name}</h3>
            <p className="muted">{o.blurb}</p>
            <p className="muted">
              {o.color} · {o.level} · {o.chapters.length} chapters
            </p>
          </Link>
        ))}
      </div>
    </>
  );
}
