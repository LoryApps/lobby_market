import type { Metadata } from 'next'
import { BroadcastClient } from './BroadcastClient'

export const metadata: Metadata = {
  title: 'Civic Broadcast · Lobby Market',
  description:
    'Live: the hottest civic debate happening right now — split-screen arguments, a real-time vote bar, and platform-wide activity. Your front-row seat to democracy in motion.',
  openGraph: {
    title: 'Civic Broadcast · Lobby Market',
    description:
      'Watch the most active debate live: arguments, vote splits, and consensus forming in real time.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Broadcast · Lobby Market',
    description:
      "Live feed of the Lobby's hottest debate — arguments, votes, and consensus forming now.",
  },
}

export default function BroadcastPage() {
  return <BroadcastClient />
}
