import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  poweredByHeader: false,
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self)" },
      ],
    }, {
      source: "/mediapipe/1.2.3/runtime/guia.worker.js",
      headers: [{
        key: "Content-Security-Policy",
        value: "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'",
      }],
    }];
  },
};

export default nextConfig;
