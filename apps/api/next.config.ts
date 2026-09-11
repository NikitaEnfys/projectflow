import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@projectflow/contracts"],
};

export default nextConfig;
