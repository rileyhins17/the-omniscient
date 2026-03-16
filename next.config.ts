import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  serverExternalPackages: ["@cloudflare/playwright", "playwright"],
  typedRoutes: true,
};

export default nextConfig;
