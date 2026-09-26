import type { Metadata } from "next";
import { meta, PassThrough } from "@/lib/seo";

export const metadata: Metadata = meta({
  title: "Puzzle stats",
  description: "Your local puzzle rating and streak.",
  path: "/leaderboard",
  index: false,
});

export default PassThrough;
