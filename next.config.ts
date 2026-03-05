import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Typecheck is enforced via npm script (tsc --noEmit) to avoid Windows spawn EPERM in Next build.
  typescript: {
    ignoreBuildErrors: true
  },
  experimental: {
    // Reduce worker usage on Windows to avoid spawn EPERM.
    cpus: 1,
    staticGenerationMaxConcurrency: 1,
    workerThreads: true
  }
};

export default nextConfig;
