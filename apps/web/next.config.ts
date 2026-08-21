import type { NextConfig } from "next";
import { resolveApiBaseUrl } from "./src/lib/api-base-url";

resolveApiBaseUrl();

const nextConfig: NextConfig = {
  transpilePackages: ["@qably/types", "@qably/ui"],
};

export default nextConfig;
