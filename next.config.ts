import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // Next sets watchOptions.ignored as a RegExp; an array must contain only
    // glob strings, so replace it wholesale. The engine persists jobs and API
    // keys under .data/ — watching those would recompile routes on every
    // analysis event.
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ["**/node_modules/**", "**/.git/**", "**/.next/**", "**/.data/**"],
    };
    return config;
  },
};

export default nextConfig;
