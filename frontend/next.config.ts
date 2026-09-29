import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Strict Mode mounts effects twice in development. A meeting session token is
  // single-use (it authenticates exactly one WebSocket), so the double mount
  // would burn the token on a throwaway socket. Production is unaffected.
  reactStrictMode: false,
};

export default nextConfig;
