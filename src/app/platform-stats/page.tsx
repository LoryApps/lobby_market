import type { Metadata } from 'next'
import { PlatformStatsClient } from './PlatformStatsClient'

export const metadata: Metadata = {
  title: 'Platform Stats · Lobby Market',
  description:
    'Live civic impact metrics for Lobby Market — total laws established, votes cast, citizens, debates, and category breakdowns.',
  openGraph: {
    title: 'Platform Stats · Lobby Market',
    description:
      'See the cumulative civic impact: laws established, millions of votes cast, and the categories driving consensus.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Platform Stats · Lobby Market',
    description:
      'Live platform metrics — how many laws have been written by the people, and which categories are leading the charge.',
  },
}

export default function PlatformStatsPage() {
  return <PlatformStatsClient />
}
