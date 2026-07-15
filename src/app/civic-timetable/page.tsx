import type { Metadata } from 'next'
import { TimetableClient } from './TimetableClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: "Civic Timetable · Lobby Market",
  description:
    "Today's civic schedule at a glance — live debates, voting deadlines, emergency sessions, and upcoming events. Never miss a civic moment.",
  openGraph: {
    title: "Civic Timetable · Lobby Market",
    description:
      "See what's happening right now and what's coming next — debates, voting windows closing, emergency sessions, and AMA events.",
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: "Civic Timetable · Lobby Market",
    description: "Today's civic schedule — live debates, vote closings, and special events.",
  },
}

export default function TimetablePage() {
  return <TimetableClient />
}
