/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  turbopack: { root: __dirname },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: '**.supabase.in' },
    ],
  },
};
module.exports = nextConfig;
