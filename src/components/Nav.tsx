"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/auth-actions";
import { Logo } from "@/components/Logo";
import { useEffect, useRef, useState } from "react";
import { hydrateCloud, setCloudSync, useProfile } from "@/lib/store";

type User = { id: string; name: string; email: string };

const train = [
  ["/puzzles", "Puzzles"],
  ["/puzzles/daily", "Daily puzzle"],
  ["/puzzles/second-nature", "Second Nature"],
  ["/openings", "Openings"],
  ["/coordinates", "Coordinates"],
  ["/play", "Play vs bots"],
  ["/puzzles/spot-the-trap", "Spot the trap"],
  ["/puzzles/finish-the-win", "Finish the win"],
  ["/puzzles/rushed", "Rushed moves"],
] as const;

export function Nav({ user }: { user: User | null }) {
  const path = usePathname();
  const profile = useProfile();
  const bar = useRef<HTMLElement>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    setCloudSync(!!user);
    if (user) void hydrateCloud();
  }, [user]);

  useEffect(() => setOpen(null), [path]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!bar.current?.querySelector(".drop.on")?.contains(t)) setOpen(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  return (
    <nav className="nav" ref={bar}>
      <Link href="/" className="brand-link">
        <Logo />
      </Link>
      <div className="nav-links">
        <Link className={path === "/" ? "active" : ""} href="/">
          Analyzer
        </Link>
        <Link className={path.startsWith("/coach") ? "active" : ""} href="/coach">
          Coach
        </Link>
        <Link className={path.startsWith("/dashboard") ? "active" : ""} href="/dashboard">
          Dashboard
        </Link>
        <div className={`drop${open === "train" ? " on" : ""}`}>
          <button type="button" className="linkish" onClick={() => setOpen((v) => (v === "train" ? null : "train"))}>
            Train
          </button>
          {open === "train" && (
            <div className="drop-menu">
              {train.map(([href, label]) => (
                <Link key={href} href={href} onClick={() => setOpen(null)}>
                  {label}
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className={`drop${open === "compete" ? " on" : ""}`}>
          <button type="button" className="linkish" onClick={() => setOpen((v) => (v === "compete" ? null : "compete"))}>
            Compete
          </button>
          {open === "compete" && (
            <div className="drop-menu">
              <Link href="/leaderboard" onClick={() => setOpen(null)}>
                Puzzle stats
              </Link>
            </div>
          )}
        </div>
        <Link href="/about">About</Link>
      </div>
      <div className="nav-right">
        <span className="muted">{profile.plan}</span>
        {user ? (
          <>
            <span>{user.name}</span>
            <form action={logout}>
              <button className="btn" type="submit">
                Sign out
              </button>
            </form>
          </>
        ) : (
          <>
            <Link className="btn" href="/signin">
              Sign in
            </Link>
            <Link className="btn btn-primary" href="/signup">
              Sign up
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
