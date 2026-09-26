import type { Metadata } from "next";
import { meta, PassThrough } from "@/lib/seo";

export const metadata: Metadata = meta({
  title: "Play vs bots",
  description: "Play chess against strength-limited Stockfish bots in your browser.",
  path: "/play",
});

export default PassThrough;
