import type { Metadata } from 'next'
import { LighthouseClient } from './LighthouseClient'

export const metadata: Metadata = {
  title: 'The Civic Lighthouse · Lobby Market',
  description:
    'Debates that have gone dark — active topics with little engagement waiting for civic light. Every vote you cast re-ignites a forgotten conversation.',
  openGraph: {
    title: 'The Civic Lighthouse · Lobby Market',
    description:
      'Rescue neglected debates from the dark. These topics are still open, still unresolved — they just need your voice to come alive again.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'The Civic Lighthouse · Lobby Market',
    description:
      'Debates gone dark. Low engagement. No consensus yet. Your vote is the spark they need.',
  },
}

export default function LighthousePage() {
  return <LighthouseClient />
}
