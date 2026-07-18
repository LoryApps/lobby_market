import type { Metadata } from 'next'
import { DailyBriefClient } from './DailyBriefClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Daily Brief · Lobby Exchange',
  description:
    "Your personalized daily brief for the Lobby Exchange — portfolio P&L, today's movers, law watch, notable events, and picks for you.",
  robots: { index: false },
  openGraph: {
    title: 'Exchange Daily Brief · Lobby Market',
    description:
      "Today's personalized market brief — portfolio performance, top movers, law watch, and recommendations.",
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Exchange Daily Brief · Lobby Market',
    description: "Your personalized daily market brief.",
  },
}

export default function DailyBriefPage() {
  return <DailyBriefClient />
}
