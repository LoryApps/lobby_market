import type { Metadata } from 'next'
import { WeeklySummitClient } from './WeeklySummitClient'

export const metadata: Metadata = {
  title: 'Weekly Civic Summit · Lobby Market',
  description:
    'Ten curated civic debates, refreshed every Monday. Vote on all ten to earn the Summit Clout bonus. The same summit for every citizen.',
  openGraph: {
    title: 'Weekly Civic Summit · Lobby Market',
    description: 'Ten debates. One week. Vote on all ten to earn your Summit bonus.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Weekly Civic Summit · Lobby Market',
    description: 'Ten curated debates refreshed every Monday — vote on all ten for a Clout bonus.',
  },
}

export default function WeeklySummitPage() {
  return <WeeklySummitClient />
}
