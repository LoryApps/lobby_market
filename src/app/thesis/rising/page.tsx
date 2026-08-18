import type { Metadata } from 'next'
import { RisingThesesClient } from './RisingThesesClient'

export const metadata: Metadata = {
  title: 'Rising Theses · Lobby Market',
  description:
    'Civic predictions gaining the most agreement this week — ideas the community is rallying behind right now. See which theses are building momentum.',
  openGraph: {
    title: 'Rising Theses · Lobby Market',
    description:
      'Which civic predictions are gaining momentum this week? Rising theses ranked by agreement velocity — emerging consensus on Lobby Market.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Rising Theses · Lobby Market',
    description: 'Civic predictions the community is rapidly agreeing with — ranked by 7-day agreement momentum.',
  },
}

export default function RisingThesesPage() {
  return <RisingThesesClient />
}
