import type { Metadata } from 'next'
import { GuideClient } from './GuideClient'

export const metadata: Metadata = {
  title: 'Exchange Guide · Lobby Market',
  description:
    'How the Civic Exchange works — understand prediction markets, read consensus signals, and make your first call on any debate.',
  openGraph: {
    title: 'Exchange Guide · Lobby Market',
    description:
      'Learn how to read and participate in the Civic Exchange — every concept from ¢ pricing to momentum signals explained.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Exchange Guide · Lobby Market',
    description: 'Everything you need to understand the Civic Exchange — from price to momentum to settlement.',
  },
}

export default function ExchangeGuidePage() {
  return <GuideClient />
}
