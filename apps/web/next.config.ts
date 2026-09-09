import type { NextConfig } from "next";
import { resolveApiBaseUrl } from "./src/lib/api-base-url";

resolveApiBaseUrl();

const nextConfig: NextConfig = {
  transpilePackages: ["@qably/types", "@qably/test-naming", "@qably/ui"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
        port: "",
        pathname: "/u/**",
        search: "",
      },
    ],
  },
};

export default nextConfig;
