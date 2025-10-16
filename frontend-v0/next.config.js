/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000", "frontend-v0-delta.vercel.app"],
    },
  },
  images: {
    domains: ['localhost'],
    unoptimized: true,
  },
  transpilePackages: ['recharts'],
}

module.exports = nextConfig