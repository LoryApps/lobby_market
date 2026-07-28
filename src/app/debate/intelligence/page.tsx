import type { Metadata } from 'next'
import { IntelligenceClient } from './IntelligenceClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Debate Intelligence · Lobby Market',
  description: 'Live debate arena analytics — active debates, upcoming by RSVP, recent outcomes, top debaters, and category breakdowns.',
  openGraph: {
    title: 'Debate Intelligence · Lobby Market',
    description: "Who's debating, what's live, and what moved the needle. Real-time debate analytics for the Lobby.",
    type: 'website',
    siteName: 'Lobby Market',
  },
}

export default function DebateIntelligencePage() {
  return <IntelligenceClient />
}
