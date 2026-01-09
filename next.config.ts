import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'plus.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/**',
      },
    ],
  },
  // TODO: Re-enable after regenerating Supabase types for React 19.2.1 / Next.js 16.1.1
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Security Headers
  async headers() {
    // Determine if we're in production for stricter headers
    const isProd = process.env.NODE_ENV === 'production'
    
    return [
      {
        // Apply security headers to all routes
        source: '/:path*',
        headers: [
          // HTTP Strict Transport Security (HSTS)
          // Forces browsers to use HTTPS for 2 years
          ...(isProd ? [{
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          }] : []),
          // Prevent clickjacking attacks
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          // Prevent MIME type sniffing
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // Control referrer information
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // Enable XSS protection in older browsers
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          // DNS prefetch control
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          // Permissions Policy (formerly Feature-Policy)
          // Restrict powerful features to same-origin only
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self), payment=(self), usb=()',
          },
        ],
      },
      {
        // CORS headers for API routes - be restrictive in production
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Credentials',
            value: 'true',
          },
          // Only set CORS origin if explicitly configured
          // In production: use NEXT_PUBLIC_APP_URL if set, otherwise omit (same-origin only)
          // In dev: allow all origins (*) for development convenience
          ...((process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL.trim()) || !isProd ? [{
            key: 'Access-Control-Allow-Origin',
            value: (process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL.trim()) || '*',
          }] : []),
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, X-Requested-With',
          },
          {
            key: 'Access-Control-Max-Age',
            value: '86400', // 24 hours
          },
        ],
      },
    ];
  },
};

export default nextConfig;
