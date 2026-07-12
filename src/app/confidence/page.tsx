import type { Metadata } from 'next'
import { ConfidenceClient } from './ConfidenceClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Motion of No Confidence · Lobby Market',
  description:
    'Table or vote on a formal motion of no confidence in the governing coalition. A carried motion triggers a constitutional crisis and forces the government to seek a new mandate.',
  openGraph: {
    title: 'Motion of No Confidence · Lobby Market',
    description:
      'The parliamentary mechanism for challenging the ruling coalition. Table a motion, vote, and reshape the balance of power in the Lobby.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Motion of No Confidence · Lobby Market',
    description:
      'Table or vote on a formal motion of no confidence in the governing coalition.',
  },
}

export default function ConfidencePage() {
  return <ConfidenceClient />
}
