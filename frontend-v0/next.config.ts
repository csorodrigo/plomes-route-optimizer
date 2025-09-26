import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure environment variables are available at runtime
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '',
  },

  // Configure rewrites for API routes in production
  async rewrites() {
    // Only apply rewrites in development or when API_URL is not set
    const shouldRewrite = process.env.NODE_ENV === 'development' ||
                         !process.env.NEXT_PUBLIC_API_URL;

    if (shouldRewrite) {
      return [
        {
          source: '/api/:path*',
          destination: '/api/:path*', // Keep serverless functions
        },
      ];
    }

    return [];
  },

  // Ensure proper headers for CORS
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
        ],
      },
    ];
  },
};

export default nextConfig;
