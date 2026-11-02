import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // packages/shared ships TypeScript source.
  transpilePackages: ["@dltube/shared"],
};

export default nextConfig;
