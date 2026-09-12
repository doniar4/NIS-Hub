import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 2 MiB avatar input plus multipart overhead; same-origin action checks retained.
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
};

export default nextConfig;
