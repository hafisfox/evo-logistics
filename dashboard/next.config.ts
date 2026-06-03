import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["googleapis"],
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "radix-ui",
      "@tanstack/react-query",
    ],
  },
};

export default nextConfig;
