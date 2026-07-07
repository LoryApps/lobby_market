import type { Metadata } from 'next'
import { RelaysClient } from './RelaysClient'

export const metadata: Metadata = {
  title: 'Civic Relays · Lobby Market',
  description:
    'Collaborative argument chains where citizens build on each other\'s reasoning, one leg at a time. Join an open relay or vote on completed ones.',
  openGraph: {
    title: 'Civic Relays · Lobby Market',
    description: 'Collaborative argument chains — FOR and AGAINST, built leg by leg with the community.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Relays · Lobby Market',
    description: 'Join the chain. Add your argument leg by leg.',
  },
}

export default function RelaysPage() {
  return <RelaysClient />
}
