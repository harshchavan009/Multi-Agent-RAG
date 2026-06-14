/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for production Docker builds
  output: 'standalone',

  // Experimental features
  experimental: {
    // Reduce bundle size
    optimizePackageImports: ['lucide-react', 'recharts', 'framer-motion'],
  },

  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },

  // Headers for security
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },

  // Rewrites for API proxy in development
  async rewrites() {
    const apiBase = process.env.NEXT_PUBLIC_API_URL
      ? process.env.NEXT_PUBLIC_API_URL.replace('/api/v1', '')
      : 'http://localhost:8000'
    return process.env.NODE_ENV === 'development'
      ? [
          {
            source: '/proxy/:path*',
            destination: `${apiBase}/:path*`,
          },
        ]
      : []
  },
}

module.exports = nextConfig
