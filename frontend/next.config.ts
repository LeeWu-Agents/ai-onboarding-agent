import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  devIndicators: {
    position: 'bottom-left',
  },
  ...(process.env.NODE_ENV === 'development' && {
    allowedDevOrigins: ['172.19.78.92'],
  }),
};

export default nextConfig;
