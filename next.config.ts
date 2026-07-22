import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable large file uploads up to 100MB
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb",
    },
  },
  // Increase API response timeout
  serverExternalPackages: [],
};

export default nextConfig;
