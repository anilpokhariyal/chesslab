import type { Metadata } from "next";
import { meta, PassThrough } from "@/lib/seo";

export const metadata: Metadata = meta({
  title: "Second Nature trainer",
  description: "Woodpecker-style puzzle sets. Repeat the same tactics until they are automatic.",
  path: "/puzzles/second-nature",
});

export default PassThrough;
