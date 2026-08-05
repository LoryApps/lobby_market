import type { Metadata } from 'next'
import { SwingClient } from './SwingClient'

export const metadata: Metadata = {
  title: 'The Civic Swing · Lobby Market',
  description:
    'Topics where recent votes are actively reversing the established consensus — debates mid-flip. Ranked by swing magnitude: how far the last 6 hours diverge from the overall vote split.',
  openGraph: {
    title: 'The Civic Swing · Lobby Market',
    description:
      'Public opinion in motion. These debates are showing vote reversals right now — the direction of consensus is actively changing. Who\'s flipping, and by how much?',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'The Civic Swing · Lobby Market',
    description:
      'Debates where recent votes are going against the current consensus — opinion reversals in progress, ranked by magnitude.',
  },
}

export default function SwingPage() {
  return <SwingClient />
}
