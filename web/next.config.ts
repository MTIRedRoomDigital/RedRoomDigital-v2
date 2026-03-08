import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow images from any domain (for character avatars, etc.)
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
};

export default nextConfig;
