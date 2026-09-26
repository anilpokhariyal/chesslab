import type { MetadataRoute } from "next";
import { OPENINGS } from "@/lib/openings";
import { siteUrl } from "@/lib/seo";

const PUBLIC = [
  "/",
  "/about",
  "/pricing",
  "/puzzles",
  "/puzzles/daily",
  "/puzzles/second-nature",
  "/puzzles/spot-the-trap",
  "/puzzles/finish-the-win",
  "/puzzles/rushed",
  "/openings",
  "/coordinates",
  "/play",
  "/coach",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return [
    ...PUBLIC.map((path) => ({
      url: `${base}${path === "/" ? "" : path}`,
      changeFrequency: "weekly" as const,
      priority: path === "/" ? 1 : 0.7,
    })),
    ...OPENINGS.map((o) => ({
      url: `${base}/openings/${o.id}`,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
