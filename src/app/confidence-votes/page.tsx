import type { Metadata } from 'next'
import { ConfidenceVotesClient } from './ConfidenceVotesClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Confidence Votes · Lobby Market',
  description:
    'Westminster-style motions of confidence, no confidence, and censure against civic bodies. Two-phase process: gather seconds to table the motion, then divide the chamber.',
  openGraph: {
    title: 'Confidence Votes · Lobby Market',
    description:
      'Formal democratic accountability in the Lobby — table motions of no confidence against coalitions, committees, and officers. Gather seconds, open the division, carry the motion.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Confidence Votes · Lobby Market',
    description:
      'Westminster-style motions of no confidence, confidence, and censure. Table a motion, gather 10 seconds, divide the chamber.',
  },
}

export default function ConfidenceVotesPage() {
  return <ConfidenceVotesClient />
}
