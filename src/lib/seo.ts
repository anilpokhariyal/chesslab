import type { Metadata } from "next";

export function siteUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export const SITE = {
  name: "ChessLab",
  tagline: "Analyze, train, and play chess in your browser",
  description:
    "Free chess analyzer with Stockfish in your browser. Import PGN, Chess.com, and Lichess games. Puzzles, opening drills, and bots — no upload required.",
};

export function meta(opts: {
  title: string;
  description: string;
  path: string;
  index?: boolean;
}): Metadata {
  const url = `${siteUrl()}${opts.path}`;
  const full = `${opts.title} · ${SITE.name}`;
  return {
    title: { absolute: full },
    description: opts.description,
    alternates: { canonical: url },
    robots: opts.index === false ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: { title: full, description: opts.description, url, type: "website" },
    twitter: { card: "summary_large_image", title: full, description: opts.description },
  };
}

export function PassThrough({ children }: { children: React.ReactNode }) {
  return children;
}

export function jsonLd(): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: SITE.name,
    url: siteUrl(),
    description: SITE.description,
    applicationCategory: "GameApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  });
}
