import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@pitchzone/ui'],
  // Use standalone output for Docker builds (like Fly.io), but let Vercel handle its own output
  ...(process.env.VERCEL !== '1' && { output: 'standalone' }),
};

export default nextConfig;
