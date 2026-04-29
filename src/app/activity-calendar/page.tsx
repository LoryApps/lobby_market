import type { Metadata } from 'next'
import { ActivityCalendarClient } from './ActivityCalendarClient'

export const metadata: Metadata = {
  title: 'Activity Calendar · Lobby Market',
  description:
    'A GitHub-style contribution calendar showing daily civic engagement — votes cast, arguments made, and laws established across the year.',
  openGraph: {
    title: 'Activity Calendar · Lobby Market',
    description: 'See the full year of civic activity at a glance. Every square is a day of democracy.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Activity Calendar · Lobby Market',
    description: 'Your year of civic action — one square at a time.',
  },
}

export default function ActivityCalendarPage() {
  return <ActivityCalendarClient />
}
