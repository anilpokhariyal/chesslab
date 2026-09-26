import type { Metadata } from "next";
import { meta, PassThrough } from "@/lib/seo";

export const metadata: Metadata = meta({
  title: "Daily chess puzzle",
  description: "Today’s Lichess daily puzzle. One position, one session.",
  path: "/puzzles/daily",
});

export default PassThrough;
