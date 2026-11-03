import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // The web downloader is retired; its pages now point at the desktop app on the home page.
  redirects() {
    return [
      { source: "/download", destination: "/#download", permanent: true },
      { source: "/download-app", destination: "/#download", permanent: true },
    ];
  },
};

export default nextConfig;
