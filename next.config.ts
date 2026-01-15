// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* 1. Supabase Image Config */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'zniinqiqnwndnowzzjyt.supabase.co',
      },
    ],
  },
  
  /* 2. IGNORE ALL BUILD ERRORS (The Nuclear Option) */
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // @ts-ignore
  eslint: {
    ignoreDuringBuilds: true,
  }
};

export default nextConfig;