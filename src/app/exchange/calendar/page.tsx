import type { Metadata } from 'next'
import { CalendarClient } from './CalendarClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Market Calendar · Lobby Exchange',
  description:
    'Upcoming civic market resolutions — see every debate with a voting deadline, sorted by urgency. Never miss a market close.',
  robots: { index: false },
  openGraph: {
    title: 'Market Calendar · Lobby Exchange',
    description: 'All civic markets with upcoming settlement dates — sorted by deadline, filtered by urgency.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Market Calendar · Lobby Exchange',
    description: 'Track upcoming market resolutions on the Civic Exchange — closing today, this week, and beyond.',
  },
}

export default function CalendarPage() {
  return <CalendarClient />
}
