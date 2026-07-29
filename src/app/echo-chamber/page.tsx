import type { Metadata } from 'next'
import { EchoChamberClient } from './EchoChamberClient'

export const metadata: Metadata = {
  title: 'Echo Chamber · Lobby Market',
  description:
    'See where your follow network creates a one-sided civic view. Discover your diversity score, detect echo chambers in your feed, and find contrarian voices that challenge your thinking.',
  openGraph: {
    title: 'Echo Chamber · Lobby Market',
    description:
      'Diagnose your civic echo chambers — find topics where everyone you follow votes the same way, and discover diverse voices that challenge your perspective.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Echo Chamber · Lobby Market',
    description:
      'Detect where your follow network votes as one — and find voices that push back.',
  },
}

export default function EchoChamberPage() {
  return <EchoChamberClient />
}
