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
  //
  // jsdom (used by qr-code-styling's SVG rendering in src/modules/qr/service.ts) pulls in
  // html-encoding-sniffer -> @exodus/bytes, an ESM-only package. Bundling jsdom rewrites that
  // chain's require() calls and breaks CJS/ESM interop at runtime
  // ("ERR_REQUIRE_ESM" on every request in production, even though it built fine). Keeping
  // jsdom external leaves Node's own module resolution to handle the ESM import correctly.
  serverExternalPackages: ["geoip-lite", "jsdom"],
};

export default nextConfig;
