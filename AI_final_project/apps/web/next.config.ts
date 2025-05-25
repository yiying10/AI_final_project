import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    turbo: undefined,
  },
  webpack: (config) => {
    config.externals.push({
      lightningcss: 'lightningcss',
    });
    return config;
  },
};

export default nextConfig;
