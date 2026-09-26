import type { Metadata } from "next";
import { meta, PassThrough } from "@/lib/seo";

export const metadata: Metadata = meta({
  title: "Finish the win",
  description: "Convert a winning chess position. Practice the last accurate moves.",
  path: "/puzzles/finish-the-win",
});

export default PassThrough;
