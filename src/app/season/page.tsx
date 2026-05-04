import type { Metadata } from 'next'
import { SeasonClient } from './SeasonClient'

export const metadata: Metadata = {
  title: 'Civic Season · Lobby Market',
  description:
    'Monthly competitive seasons — earn Season Points for every vote, argument, and law you help pass. Top citizens win exclusive seasonal titles.',
  openGraph: {
    title: 'Civic Season · Lobby Market',
    description:
      'Compete across the month. Every vote, argument, debate, and law earns Season Points. The top citizens earn legendary titles.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Civic Season · Lobby Market',
    description:
      'Monthly civic championship — climb the season leaderboard one vote at a time.',
  },
}

export default function SeasonPage() {
  return <SeasonClient />
}
