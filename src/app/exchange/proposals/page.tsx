import type { Metadata } from 'next'
import { ProposalsClient } from './ProposalsClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Market Proposals · Lobby Exchange',
  description:
    'Vote on community-submitted proposals for new civic prediction markets. The most-upvoted proposals become live markets.',
  robots: { index: false },
  openGraph: {
    title: 'Market Proposals · Lobby Exchange',
    description:
      'Help shape the Exchange — browse and upvote proposals for the next civic prediction markets.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Market Proposals · Lobby Exchange',
    description: 'Community-submitted civic market proposals — vote to get them live.',
  },
}

export default function ProposalsPage() {
  return <ProposalsClient />
}
