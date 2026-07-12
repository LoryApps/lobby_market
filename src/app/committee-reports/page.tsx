import type { Metadata } from 'next'
import { CommitteeReportsClient } from './CommitteeReportsClient'

export const metadata: Metadata = {
  title: 'Committee Reports · Lobby Market',
  description:
    'Formal analysis and policy recommendations from civic committee chairs — browse, filter, and endorse reports across all categories.',
  openGraph: {
    title: 'Committee Reports · Lobby Market',
    description:
      'Formal analysis and policy recommendations published by civic committee chairs. Browse by category, sort by endorsements, and signal agreement.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Committee Reports · Lobby Market',
    description: 'Formal civic committee analysis — published findings and policy recommendations.',
  },
}

export default function CommitteeReportsPage() {
  return <CommitteeReportsClient />
}
