import type { Metadata } from 'next'
import { AppealsClient } from './AppealsClient'

export const metadata: Metadata = {
  title: 'Civic Appeals Panel · Lobby Market',
  description:
    'The final civic recourse tier on Lobby Market. Formally contest Ombudsman findings, Grand Council outcomes, moderation actions, and disputed vote results. Panel of three senior citizens deliberates each appeal.',
  openGraph: {
    title: 'Civic Appeals Panel · Lobby Market',
    description:
      'Contest civic decisions through formal appeal. An independent rotating panel reviews each case. The last word in Lobby Market governance.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Appeals Panel · Lobby Market',
    description:
      'Formal appeal review for Ombudsman findings, Council motions, moderation actions, and vote outcomes.',
  },
}

export default function AppealsPage() {
  return <AppealsClient />
}
