import type { Metadata } from 'next'
import { FulcrumClient } from './FulcrumClient'

export const metadata: Metadata = {
  title: 'The Civic Fulcrum · Lobby Market',
  description:
    'Debates balanced on a knife-edge — the most perfectly split 50/50 votes on Lobby Market, with the decisive argument from each side surfaced side by side. The fulcrum is where one voice can tip the scales.',
  openGraph: {
    title: 'The Civic Fulcrum · Lobby Market',
    description:
      'Near-perfect 50/50 splits: where both sides hold equal ground and one decisive argument could tip everything. See the debates where your vote matters most.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'The Civic Fulcrum · Lobby Market',
    description:
      'The closest civic debates on Lobby Market — 50/50 splits where one more vote changes everything.',
  },
}

export default function FulcrumPage() {
  return <FulcrumClient />
}
