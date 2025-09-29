import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fix for workspace root detection - disabled for Vercel deployment
  // outputFileTracingRoot: "../",

  // Enable experimental features
  experimental: {
    // Enable serverActions for form handling
    serverActions: {
      allowedOrigins: ["localhost:3003", "*.vercel.app"]
    }
  },

  // Image optimization configuration
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "maps.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
      }
    ],
  },

  // Headers for security and CORS
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "*"
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, DELETE, OPTIONS"
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization"
          }
        ]
      }
    ];
  },

  // Redirects for legacy API endpoints
  async rewrites() {
    return [
      {
        source: "/api/legacy/:path*",
        destination: "/api/:path*"
      }
    ];
  },

  // Webpack configuration
  webpack: (config, { dev, isServer }) => {
    // Fix for leaflet in SSR
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }

    return config;
  },

  // Environment variables validation at build time
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  }
};

export default nextConfig;
