import type { Metadata } from 'next'
import { FrontlinesClient } from './FrontlinesClient'

export const metadata: Metadata = {
  title: 'The Civic Frontlines · Lobby Market',
  description:
    'A live battle map of every contested debate on Lobby Market — sorted by how close the vote is right now. Battle Zone debates are within ±5% of 50/50. Every vote is decisive.',
  openGraph: {
    title: 'The Civic Frontlines · Lobby Market',
    description:
      'Which debates are closest to 50/50 right now? See the Battle Zone, Contested, and Leaning tiers. Find where your vote matters most.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'The Civic Frontlines · Lobby Market',
    description:
      'The live battle map of civic debate. Battle Zone debates are within ±5% of tied. Your vote could genuinely tip the outcome.',
  },
}

export default function FrontlinesPage() {
  return <FrontlinesClient />
}
