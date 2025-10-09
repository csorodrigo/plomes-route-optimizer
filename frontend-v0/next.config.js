/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000", "frontend-v0-delta.vercel.app"],
    },
  },
  images: {
    domains: ['localhost'],
    unoptimized: true,
  },
  transpilePackages: [],
  output: 'standalone',
}

module.exports = nextConfig