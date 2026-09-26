import type { Metadata } from "next";
import { meta, PassThrough } from "@/lib/seo";

export const metadata: Metadata = meta({
  title: "Coordinate trainer",
  description: "Learn chessboard coordinates. Click the named square as fast as you can.",
  path: "/coordinates",
});

export default PassThrough;
