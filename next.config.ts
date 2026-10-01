import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 2 MiB avatar input plus multipart overhead; same-origin action checks retained.
  experimental: {
    serverActions: { bodySizeLimit: "3mb" },
    // The CLI checker can lose captured stdout on newer Node runtimes.
    // TypeScript 5 ships the compiler API, which is stable for this project.
    useTypeScriptCli: false,
  },
};

export default nextConfig;
