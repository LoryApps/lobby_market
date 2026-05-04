import type { Metadata } from 'next'
import { PledgesClient } from './PledgesClient'

export const metadata: Metadata = {
  title: 'Civic Pledge Wall · Lobby Market',
  description:
    'Make public commitments to civic action and hold each other accountable. Witness your fellow citizens\' pledges — from voting on every active topic to championing a cause.',
  openGraph: {
    title: 'Civic Pledge Wall · Lobby Market',
    description:
      'Public civic commitments, witnessed by the community. Actions speak louder than votes.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Pledge Wall · Lobby Market',
    description: 'Make a public civic pledge. Let the community witness your commitment.',
  },
}

export default function PledgesPage() {
  return <PledgesClient />
}
