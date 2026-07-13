import type { Metadata } from 'next'
import { PmqsClient } from './PmqsClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Prime Minister\'s Questions · Lobby Market',
  description:
    'The weekly session where the Prime Minister faces questions from citizens. Submit your question, upvote the ones that matter most, and hold power to account.',
  openGraph: {
    title: 'Prime Minister\'s Questions · Lobby Market',
    description:
      'PMQs: the civic chamber where the ruling coalition leader is held to account. Submit and upvote questions — the most popular get answered.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Prime Minister\'s Questions · Lobby Market',
    description: 'Weekly civic Q&A — submit your question, hold the PM to account.',
  },
}

export default function PmqsPage() {
  return <PmqsClient />
}
