import type { Metadata } from 'next'
import { CanaryClient } from './CanaryClient'

export const metadata: Metadata = {
  title: 'The Civic Canary · Lobby Market',
  description:
    'Early-warning signals for civic debates about to become significant — rising vote velocity, quiet storms building, topics on the brink of activation, and argument surges before they trend.',
  openGraph: {
    title: 'The Civic Canary · Lobby Market',
    description:
      'Detect the next big civic debate before it trends. The Canary watches for velocity surges, viewer-to-voter buildups, activation countdowns, and argument acceleration.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'The Civic Canary · Lobby Market',
    description: 'Early-warning signals for debates about to explode — before they trend.',
  },
}

export default function CanaryPage() {
  return <CanaryClient />
}
