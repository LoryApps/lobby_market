import type { Metadata } from 'next'
import { DigestClient } from './DigestClient'

export const metadata: Metadata = {
  title: 'Relay Digest · Lobby Market',
  description:
    'The weekly Relay Digest — featured chains, top contributors, most-starred argument legs, and a category breakdown of relay activity across the Lobby.',
  openGraph: {
    title: 'Relay Digest · Lobby Market',
    description:
      'This week in Civic Relays: top chains, best argument legs, rising contributors, and category trends — your weekly roundup.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Relay Digest · Lobby Market',
    description:
      'Weekly roundup of relay chain activity — featured chains, top legs, and the contributors building the best civic arguments.',
  },
}

export default function RelayDigestPage() {
  return <DigestClient />
}
