import type { Metadata } from 'next'
import { CensusClient } from './CensusClient'

export const metadata: Metadata = {
  title: 'Civic Census · Lobby Market',
  description:
    'Platform-wide demographic and ideological analysis — role distribution, category ideology, voter activity, and consensus quality across the entire Lobby.',
  openGraph: {
    title: 'Civic Census · Lobby Market',
    description:
      'Who votes what, and how? A demographic breakdown of every voice in the Lobby — role distribution, category leanings, and consensus health.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Census · Lobby Market',
    description: 'Platform demographics, ideology, and consensus quality — the full picture of who makes up the Lobby.',
  },
}

export default function CensusPage() {
  return <CensusClient />
}
