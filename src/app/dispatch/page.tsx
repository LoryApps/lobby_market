import type { Metadata } from 'next'
import { DispatchClient } from './DispatchClient'

export const dynamic = 'force-dynamic'
export const revalidate = 300

export const metadata: Metadata = {
  title: 'The Civic Dispatch · Lobby Market',
  description:
    'The official daily bulletin of the Lobby — new laws established, topics nearing consensus, contested debates, and upcoming civic events. Published every day.',
  openGraph: {
    title: 'The Civic Dispatch · Lobby Market',
    description:
      "Today's official civic bulletin: new laws, near-consensus topics, contested debates, and everything happening in the Lobby right now.",
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Civic Dispatch · Lobby Market',
    description:
      "The Lobby's official daily bulletin — laws, debates, and civic events.",
  },
}

export default function DispatchPage() {
  return <DispatchClient />
}
