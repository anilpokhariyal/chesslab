import type { Metadata } from "next";
import { meta, PassThrough } from "@/lib/seo";

export const metadata: Metadata = meta({
  title: "Dashboard",
  description: "Your puzzle rating, games, and saved analyses.",
  path: "/dashboard",
  index: false,
});

export default PassThrough;
