import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The Supabase-generated union types + 100+ route files cause the TS type
  // checker to exceed V8's Map capacity. Compilation (SWC) still runs; types
  // are verified locally via `npx tsc --noEmit`.
  typescript: {
    ignoreBuildErrors: true,
  },

  // 470+ route files cause ESLint to OOM at the heap limit during `next build`.
  // Linting runs as a separate CI step; skipping it here keeps the production
  // build from crashing on memory.
  eslint: {
    ignoreDuringBuilds: true,
  },

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

  // Never delete .next/ at build start — the pages-manifest.json written by
  // the previous webpack run must survive long enough for Next.js's static-
  // generation phase to read it. cleanDistDir: true (the default) deletes
  // .next/ before webpack runs, which causes a race: webpack writes the file
  // late in compilation while the static-gen worker tries to read it early.
  // Keeping it false is safe because webpack (cache: false below) always
  // regenerates all artifacts from scratch anyway.
  cleanDistDir: false,

  // Disable webpack filesystem cache to avoid holding file descriptors open
  // across the compilation → static-generation boundary (4096 fd limit in CI).
  webpack: (config, { isServer }) => {
    config.cache = false

    // App Router-only project: pages-manifest.json is sometimes not written
    // early enough for Next.js 14's static-generation phase. Writing it
    // unconditionally after every server emit ensures it's always present.
    if (isServer) {
      config.plugins.push({
        apply(compiler) {
          compiler.hooks.afterEmit.tapAsync('PagesManifestFallback', (_compilation, callback) => {
            const manifestPath = join(process.cwd(), '.next/server/pages-manifest.json')
            if (!existsSync(manifestPath)) {
              mkdirSync(join(process.cwd(), '.next/server'), { recursive: true })
              writeFileSync(manifestPath, '{"/_error":"pages/_error.js","/_app":"pages/_app.js","/_document":"pages/_document.js"}')
            }
            callback()
          })
        },
      })
    }

    return config
  },

  // ── Bundle optimisations ──────────────────────────────────────────────────
  experimental: {
    // Exclude .git from file tracing to prevent EMFILE errors during static generation.
    outputFileTracingExcludes: {
      '*': ['.git/**', '.git/logs/**'],
    },
    // Limit parallel workers to avoid EMFILE (too many open files) with 700+ routes.
    cpus: 1,
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
        // Service worker must never be served from cache — browsers use the
        // byte-diff of the SW file to decide whether to install a new version.
        // A cached SW means users run stale code indefinitely.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        // Offline fallback page — cache for a short time so it's available
        // but refreshes on every navigation when online.
        source: '/offline.html',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600, stale-while-revalidate=86400' },
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
      {
        // Profile badges — allow any origin to embed the SVG (GitHub READMEs, etc.)
        source: '/api/badges/(.*)',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Cache at CDN for 5 min, serve stale for 10 min while revalidating
          { key: 'Cache-Control', value: 'public, s-maxage=300, stale-while-revalidate=600' },
        ],
      },
      {
        // Public REST API v1 — open CORS for programmatic access from any origin.
        // All v1 endpoints are read-only and backed by the public Supabase anon key.
        source: '/api/v1/(.*)',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Accept' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ]
  },
}

export default nextConfig
