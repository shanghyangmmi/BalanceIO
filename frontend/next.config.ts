import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  // Ensure trailing slashes for IIS compatibility often helps
  trailingSlash: true,
};

export default nextConfig;
