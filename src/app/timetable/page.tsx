import type { Metadata } from 'next'
import { TimetableClient } from './TimetableClient'

export const metadata: Metadata = {
  title: "What's On · Civic Timetable · Lobby Market",
  description:
    "The live schedule of civic events — debates starting today, voting windows closing soon, and special sessions happening right now.",
  openGraph: {
    title: "What's On · Civic Timetable · Lobby Market",
    description:
      "Today's civic schedule: live debates, closing votes, AMA sessions, and emergency debates — all in one place.",
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: "What's On · Civic Timetable",
    description: "Live debates, closing votes, and special events — happening right now on Lobby Market.",
  },
}

export default function TimetablePage() {
  return <TimetableClient />
}
