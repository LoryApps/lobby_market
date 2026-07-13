import type { Metadata } from 'next'
import { CivicPollsClient } from './CivicPollsClient'

export const metadata: Metadata = {
  title: 'Civic Polls · Lobby Market',
  description:
    'Quick community polls on civic topics — vote in seconds, see live results. Distinct from the formal FOR/AGAINST policy debates, polls are lightweight pulse-checks on what the community thinks.',
  openGraph: {
    title: 'Civic Polls · Lobby Market',
    description:
      'The community\'s pulse in real time. Vote on multi-option civic polls and see where the Lobby stands.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Polls · Lobby Market',
    description: 'Quick community votes — up to 4 options, live results, time-limited.',
  },
}

export default function CivicPollsPage() {
  return <CivicPollsClient />
}
