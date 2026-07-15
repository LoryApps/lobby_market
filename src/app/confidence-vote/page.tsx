import type { Metadata } from 'next'
import { ConfidenceVoteClient } from './ConfidenceVoteClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Confidence Votes · Lobby Market',
  description:
    'Table a formal vote of no confidence in any civic body — coalition, committee, council, or officer. 10 seconds opens a 48-hour division; a majority carries the motion.',
  openGraph: {
    title: 'Confidence Votes · Lobby Market',
    description:
      'Westminster-style confidence votes: table a motion, gather seconds, open the division. The most powerful check on civic power.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Confidence Votes · Lobby Market',
    description: 'Formal votes of no confidence in civic bodies. Table a motion, get 10 seconds, open the division.',
  },
}

export default function ConfidenceVotePage() {
  return <ConfidenceVoteClient />
}
