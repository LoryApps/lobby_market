import type { Metadata } from 'next'
import { TwinsClient } from './TwinsClient'

export const metadata: Metadata = {
  title: 'Civic Twins · Lobby Market',
  description:
    'Find citizens who voted most like you. Discover your civic soulmates — people who share your convictions across economics, politics, technology, and more.',
  openGraph: {
    title: 'Civic Twins · Lobby Market',
    description:
      'Who thinks like you? Compare your civic fingerprint against every voter on Lobby Market and find the citizens most aligned with your democratic convictions.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Twins · Lobby Market',
    description:
      'Discover the citizens who voted most like you across every civic debate on Lobby Market.',
  },
}

export default function CivicTwinsPage() {
  return <TwinsClient />
}
