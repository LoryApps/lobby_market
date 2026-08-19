import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Lobby Market',
    short_name: 'Lobby',
    description: 'Write the law. Build the consensus.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0f',
    theme_color: '#0a0a0f',
    orientation: 'portrait',
    categories: ['news', 'politics', 'social'],
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
        purpose: 'any',
      },
      {
        src: '/assets/logo-mark.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Browse Topics',
        short_name: 'Browse',
        description: 'Explore trending topics and arguments',
        url: '/topics/browse',
        icons: [{ src: '/assets/logo-mark.png', sizes: '96x96' }],
      },
      {
        name: 'Live Debates',
        short_name: 'Debates',
        description: 'Join live debates happening now',
        url: '/debates',
        icons: [{ src: '/assets/logo-mark.png', sizes: '96x96' }],
      },
      {
        name: 'Create Topic',
        short_name: 'Create',
        description: 'Propose a new topic or law',
        url: '/create',
        icons: [{ src: '/assets/logo-mark.png', sizes: '96x96' }],
      },
    ],
    screenshots: [
      {
        src: '/assets/og-share.png',
        sizes: '1200x630',
        type: 'image/png',
      },
    ],
  }
}
