import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["10.96.124.189"],
  turbopack: {
    root: process.cwd(),
  },
};
export default nextConfig;
