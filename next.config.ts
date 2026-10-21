import type { NextConfig } from "next";
import path from "path";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_SENTRY_DSN: process.env.SENTRY_DSN,
  },
  turbopack: {
    root: path.join(__dirname),
  },
  // geoip-lite reads its .dat data files via fs at runtime, relative to its own package
  // directory — Next's build-time file tracing mis-resolves that path if the package gets
  // bundled. Keeping it external leaves it to normal node_modules resolution at request time.
  serverExternalPackages: ["geoip-lite"],
};

export default withSentryConfig(nextConfig, {
  silent: true,
});
