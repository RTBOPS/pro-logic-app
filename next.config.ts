import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
      { protocol: 'https', hostname: 'img.freepik.com' },
      { protocol: 'https', hostname: 'storage.googleapis.com' },
      { protocol: 'https', hostname: 'openweathermap.org' },
      { protocol: 'https', hostname: 'tile.openstreetmap.org' },
    ],
  },
};

export default nextConfig;
