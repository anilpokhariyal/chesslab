import type { Metadata } from "next";
import { meta, PassThrough } from "@/lib/seo";

export const metadata: Metadata = meta({
  title: "Chess puzzles",
  description: "Rated chess tactics from Lichess. Adaptive puzzles that live in your browser.",
  path: "/puzzles",
});

export default PassThrough;
