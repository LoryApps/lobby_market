/** @type {import('next').NextConfig} */
const nextConfig = {
  // ── Image optimization ────────────────────────────────────────────────────
  images: {
    // Allow Next.js Image component to optimize avatars & media from Supabase storage
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'jysabvbfruvyhbqdhnmh.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      // Allow any Supabase project (for env-swapped deployments)
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
    // Serve modern image formats when the browser supports them
    formats: ['image/avif', 'image/webp'],
  },

  // ── Bundle optimisations ──────────────────────────────────────────────────
  experimental: {
    // Reduces bundle size by only importing the specific sub-paths used.
    // Critical for lucide-react (300+ icons), framer-motion, and Three.js helpers.
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
      '@supabase/supabase-js',
      '@supabase/ssr',
      '@react-three/drei',
      '@react-three/fiber',
      'd3-force',
      'd3-selection',
      'zustand',
    ],
  },

  // ── Security headers ──────────────────────────────────────────────────────
  async headers() {
    return [
      {
        // All routes EXCEPT embed endpoints get the standard security headers.
        // Negative lookahead excludes /api/embed/* so embed widgets can be
        // iframed on any external site.
        source: '/((?!api/embed).*)',
        headers: [
          // Prevent the page from being embedded in iframes on foreign origins
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // Stop MIME-type sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Only send referrer for same origin
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Disable browser features we don't use
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          // Basic XSS protection for older browsers
          { key: 'X-XSS-Protection', value: '1; mode=block' },
        ],
      },
      {
        // Embed widget endpoints — allow cross-origin iframing from any site.
        // CSP frame-ancestors is the modern successor to X-Frame-Options.
        source: '/api/embed/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Content-Security-Policy', value: 'frame-ancestors *' },
          // Short cache: vote data changes frequently
          { key: 'Cache-Control', value: 'public, s-maxage=30, stale-while-revalidate=60' },
        ],
      },
      {
        // Long-lived cache for static assets (Next.js adds content hashes)
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Short cache for OG images (they depend on live DB data)
        source: '/api/og/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=300, stale-while-revalidate=600',
          },
        ],
      },
    ]
  },
}

export default nextConfig
