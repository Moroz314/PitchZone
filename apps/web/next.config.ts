import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@pitchzone/ui'],
  output: 'standalone',
};

export default nextConfig;
