import type { Metadata } from 'next'
import { MoodHistoryClient } from './MoodHistoryClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Mood History · Lobby Market',
  description: 'How civic sentiment has evolved over time — track positive and anxious mood trends across the platform over 7, 30, or 90 days.',
  openGraph: {
    title: 'Civic Mood History · Lobby Market',
    description: 'A time-series view of how community sentiment has shifted across civic debates. See when the Lobby was most hopeful or most frustrated.',
    type: 'website',
    siteName: 'Lobby Market',
  },
}

export default function MoodHistoryPage() {
  return <MoodHistoryClient />
}
