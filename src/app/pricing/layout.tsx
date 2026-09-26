import type { Metadata } from "next";
import { meta, PassThrough } from "@/lib/seo";

export const metadata: Metadata = meta({
  title: "Pricing",
  description: "Free Stockfish analysis. Premium for deeper search and themes. Coach for explanations.",
  path: "/pricing",
});

export default PassThrough;
