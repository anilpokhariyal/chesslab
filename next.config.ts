import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@prisma/client", "prisma"],
  // ponytail: no payments yet. Drop this redirect when Pricing should show again.
  async redirects() {
    return [{ source: "/pricing", destination: "/", permanent: false }];
  },
};

export default nextConfig;
