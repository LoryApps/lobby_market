import type { Metadata } from 'next'
import { FuturesClient } from './FuturesClient'

export const metadata: Metadata = {
  title: 'Civic Futures · Lobby Market',
  description:
    'What\'s coming up on Lobby Market — upcoming scheduled debates, topics in their final voting phase, high-momentum active topics, and laws passed in the last 14 days.',
  openGraph: {
    title: 'Civic Futures · Lobby Market',
    description:
      'The platform events calendar: scheduled debates, vote deadlines, momentum topics, and new laws — all in one forward-looking view.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Futures · Lobby Market',
    description:
      'Upcoming debates, voting deadlines, and new laws — the Lobby\'s forward-looking events board.',
  },
}

export default function FuturesPage() {
  return <FuturesClient />
}
