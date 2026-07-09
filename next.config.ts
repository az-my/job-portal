import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/*": ["./data/db.json", "./BACKLOG.md"],
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
