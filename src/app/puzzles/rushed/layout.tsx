import type { Metadata } from "next";
import { meta, PassThrough } from "@/lib/seo";

export const metadata: Metadata = meta({
  title: "Rushed moves",
  description: "Timed chess tactics. Find the shot before the clock runs out.",
  path: "/puzzles/rushed",
});

export default PassThrough;
