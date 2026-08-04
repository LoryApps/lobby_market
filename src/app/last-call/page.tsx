import type { Metadata } from 'next'
import { LastCallClient } from './LastCallClient'

export const metadata: Metadata = {
  title: 'Last Call · Lobby Market',
  description:
    'Vote before the window closes. These civic debates are in their final hours — ranked by urgency so your voice counts while it still can.',
  openGraph: {
    title: 'Last Call · Lobby Market',
    description:
      'Cast your vote before time runs out. Active civic debates closing soonest — ranked by urgency.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Last Call · Lobby Market',
    description:
      'Vote before the window closes. Civic debates in their final hours, ranked by urgency.',
  },
}

export default function LastCallPage() {
  return <LastCallClient />
}
