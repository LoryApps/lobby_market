import type { Metadata } from 'next'
import { LighthouseClient } from './LighthouseClient'

export const metadata: Metadata = {
  title: 'Civic Lighthouse · Lobby Market',
  description:
    'Important civic topics that have gone dark — neglected debates with real stakes that need your attention before they fade away.',
  openGraph: {
    title: 'Civic Lighthouse · Lobby Market',
    description:
      'Shine a light on neglected civic debates. These topics matter but have gone quiet — your engagement can bring them back.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Lighthouse · Lobby Market',
    description: 'Important civic debates gone dark. Neglected topics that need your voice.',
  },
}

export default function LighthousePage() {
  return <LighthouseClient />
}
