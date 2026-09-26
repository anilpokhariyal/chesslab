import type { Metadata } from "next";
import { meta, PassThrough } from "@/lib/seo";

export const metadata: Metadata = meta({
  title: "Spot the trap",
  description: "Find the tactic that punishes a tempting but losing move.",
  path: "/puzzles/spot-the-trap",
});

export default PassThrough;
