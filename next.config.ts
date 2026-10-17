import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Interactive dashboard; keep caching simple for the hackathon MVP.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
