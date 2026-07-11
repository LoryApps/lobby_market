import type { Metadata } from 'next'
import { DelegationHistoryClient } from './DelegationHistoryClient'

export const metadata: Metadata = {
  title: 'Delegation History · Lobby Market',
  description:
    'A full chronological log of every vote your delegates cast on your behalf — see what happened, whether you overrode it, and how often your opinions align.',
  openGraph: {
    title: 'Delegation History · Lobby Market',
    description: 'Track every delegated vote in your liquid democracy network.',
    type: 'website',
    siteName: 'Lobby Market',
  },
}

export default function DelegationHistoryPage() {
  return <DelegationHistoryClient />
}
