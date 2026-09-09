import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: path.join(__dirname),
  },
  // geoip-lite reads its .dat data files via fs at runtime, relative to its own package
  // directory — Next's build-time file tracing mis-resolves that path if the package gets
  // bundled. Keeping it external leaves it to normal node_modules resolution at request time.
  serverExternalPackages: ["geoip-lite"],
};

export default nextConfig;
