import type { Metadata } from "next";
import { meta, PassThrough } from "@/lib/seo";

export const metadata: Metadata = meta({
  title: "Opening trainer",
  description: "Drill popular chess openings move by move. London, Italian, Sicilian, and more.",
  path: "/openings",
});

export default PassThrough;
