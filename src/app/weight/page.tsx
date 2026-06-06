import type { Metadata } from 'next'
import { WeightClient } from './WeightClient'

export const metadata: Metadata = {
  title: 'Civic Weight Index · Lobby Market',
  description:
    'Which debates matter most right now? The Civic Weight Index ranks active topics by a composite score of scope, participation, urgency, and argument depth — so you know where your vote counts most.',
  openGraph: {
    title: 'Civic Weight Index · Lobby Market',
    description:
      'Rank active debates by civic importance: scope × engagement × urgency × depth, combined into one weight score per topic.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Weight Index · Lobby Market',
    description: 'Find the debates that matter most — ranked by scope, participation, urgency, and argument depth.',
  },
}

export default function WeightPage() {
  return <WeightClient />
}
