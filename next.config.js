/** @type {import('next').NextConfig} */
const nextConfig = {
  // Strict mode for catching React issues early
  reactStrictMode: true,

  // TypeScript build errors must be fixed (no production builds with TS errors)
  typescript: {
    ignoreBuildErrors: false,
  },

  // ESLint must pass for production builds
  eslint: {
    ignoreDuringBuilds: false,
  },

  // Optimise images from Supabase Storage
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
  },

  // Security headers are managed in vercel.json
  // No custom headers needed here
  async rewrites() {
    return [
      {
        source: '/api/citations/import',
        destination: '/api/citations/bulk-import',
      },
    ]
  },

  // Bundle analyser — enable with ANALYZE=true
  ...(process.env.ANALYZE === 'true' && {
    // Will be enabled if @next/bundle-analyzer is installed
  }),
}

module.exports = nextConfig
