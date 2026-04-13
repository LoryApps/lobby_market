import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Lobby Market',
    short_name: 'Lobby',
    description:
      'Write the law. Build the consensus. A platform where ideas compete, votes decide, and the best arguments become law.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#0a0a0f',
    theme_color: '#0a0a0f',
    categories: ['news', 'politics', 'social'],
    lang: 'en',
    icons: [
      {
        src: '/assets/logo-mark.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/assets/logo-mark.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    screenshots: [
      {
        src: '/assets/og-share.png',
        sizes: '1200x630',
        type: 'image/png',
        // @ts-expect-error – form_factor is valid in the Web App Manifest spec
        // but not yet typed in Next.js MetadataRoute.Manifest
        form_factor: 'wide',
      },
    ],
    shortcuts: [
      {
        name: 'Feed',
        short_name: 'Feed',
        description: 'Browse the live topic feed',
        url: '/',
        icons: [{ src: '/assets/logo-mark.png', sizes: '96x96' }],
      },
      {
        name: 'Search',
        short_name: 'Search',
        description: 'Search topics, laws, and people',
        url: '/search',
        icons: [{ src: '/assets/logo-mark.png', sizes: '96x96' }],
      },
      {
        name: 'The Floor',
        short_name: 'Floor',
        description: 'Watch live consensus forming',
        url: '/floor',
        icons: [{ src: '/assets/logo-mark.png', sizes: '96x96' }],
      },
      {
        name: 'Analytics',
        short_name: 'Analytics',
        description: 'Your voting stats and patterns',
        url: '/analytics',
        icons: [{ src: '/assets/logo-mark.png', sizes: '96x96' }],
      },
    ],
  }
}
