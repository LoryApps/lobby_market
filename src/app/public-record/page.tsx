import type { Metadata } from 'next'
import { PublicRecordClient } from './PublicRecordClient'

export const metadata: Metadata = {
  title: 'The Civic Public Record · Lobby Market',
  description:
    'The permanent democratic ledger of Lobby Market — every law established by consensus and every proposal rejected by the people. The unalterable record of civic decisions.',
  openGraph: {
    title: 'The Civic Public Record · Lobby Market',
    description:
      'Every democratic decision ever made on Lobby Market — laws established, proposals rejected, votes cast. The permanent civic archive.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'The Civic Public Record · Lobby Market',
    description:
      'The permanent ledger of every civic decision — laws passed and proposals rejected by the people.',
  },
}

export default function PublicRecordPage() {
  return <PublicRecordClient />
}
