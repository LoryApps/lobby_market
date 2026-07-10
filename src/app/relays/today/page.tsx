import type { Metadata } from 'next'
import { TodayRelayClient } from './TodayRelayClient'

export const metadata: Metadata = {
  title: "Today's Relays · Lobby Market",
  description:
    'Daily relay activity snapshot — the most active relay chain today, top argument legs, leading contributors, and category heatmap. Refreshes every UTC day.',
  openGraph: {
    title: "Today's Relays · Lobby Market",
    description:
      "See today's most active relay chain, top argument legs, and leading builders. Civic collaboration in real time.",
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: "Today's Relays · Lobby Market",
    description: "Today's relay spotlight — the hottest chain, top legs, and leading contributors.",
  },
}

export default function TodayRelayPage() {
  return <TodayRelayClient />
}
