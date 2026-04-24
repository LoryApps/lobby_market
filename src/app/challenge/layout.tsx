import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Daily Quorum · Lobby Market',
  description:
    "Vote on today's 3 curated topics to complete the Daily Quorum and earn Clout. Build your streak, shape the consensus.",
  openGraph: {
    title: 'Daily Quorum · Lobby Market',
    description: "Vote on today's 3 topics and earn Clout. Can you keep your streak alive?",
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Daily Quorum · Lobby Market',
    description: "Vote on today's 3 topics and earn Clout.",
  },
}

export default function ChallengeLayout({ children }: { children: ReactNode }) {
  return children
}
