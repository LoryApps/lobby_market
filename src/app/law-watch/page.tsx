import type { Metadata } from 'next'
import { LawWatchClient } from './LawWatchClient'

export const metadata: Metadata = {
  title: 'Law Watch · Lobby Market',
  description:
    'Real-time tracking of every topic on the path to becoming law — voting phase countdowns, law probability scores, and momentum signals for the debates closest to consensus.',
  openGraph: {
    title: 'Law Watch · Lobby Market',
    description:
      'Which civic debates are about to become law? Track every voting topic in real time — FOR%, time remaining, and probability of passing.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Law Watch · Lobby Market',
    description:
      'Live tracker for topics in the final voting phase. Law probability, countdown timers, and momentum signals — all in one view.',
  },
}

export default function LawWatchPage() {
  return <LawWatchClient />
}
