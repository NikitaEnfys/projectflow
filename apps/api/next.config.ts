import type {
  NextConfig,
} from "next";

const securityHeaders = [
  {
    key:
      "X-Content-Type-Options",
    value:
      "nosniff",
  },
  {
    key:
      "X-Frame-Options",
    value:
      "DENY",
  },
  {
    key:
      "Referrer-Policy",
    value:
      "strict-origin-when-cross-origin",
  },
  {
    key:
      "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=()",
  },
  {
    key:
      "X-Permitted-Cross-Domain-Policies",
    value:
      "none",
  },
];

const nextConfig: NextConfig = {
  transpilePackages: [
    "@projectflow/contracts",
  ],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers:
          securityHeaders,
      },
    ];
  },
};

export default nextConfig;
