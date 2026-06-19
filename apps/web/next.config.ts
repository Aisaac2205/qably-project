import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@qably/types", "@qably/ui"],
};

export default nextConfig;
