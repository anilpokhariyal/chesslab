import type { Metadata } from "next";
import { meta, PassThrough } from "@/lib/seo";

export const metadata: Metadata = meta({
  title: "Chess coach",
  description: "Play a coaching bot. Pick just play, mistake notes, or a line after every move.",
  path: "/coach",
});

export default PassThrough;
