"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/auth-actions";
import { Logo } from "@/components/Logo";
import { useProfile } from "@/lib/store";

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

  return (
    <nav className="nav">
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
        <details className="drop">
          <summary>Train</summary>
          <div className="drop-menu">
            {train.map(([href, label]) => (
              <Link key={href} href={href}>
                {label}
              </Link>
            ))}
          </div>
        </details>
        <details className="drop">
          <summary>Compete</summary>
          <div className="drop-menu">
            <Link href="/leaderboard">Puzzle stats</Link>
          </div>
        </details>
        <Link href="/pricing">Pricing</Link>
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
