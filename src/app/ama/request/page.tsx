import type { Metadata } from 'next'
import { RequestBoardClient } from './RequestBoardClient'

export const metadata: Metadata = {
  title: 'AMA Request Board · Lobby Market',
  description:
    'Vote for the civic expert conversations you want to see. Submit an AMA request, upvote the topics that matter to you, and help experts know where the community needs guidance.',
  openGraph: {
    title: 'AMA Request Board · Lobby Market',
    description:
      'Tell the community which expert conversations you want. Upvote AMA requests to send a signal — the most-wanted sessions get scheduled first.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'AMA Request Board · Lobby Market',
    description: 'Upvote the AMA sessions you want to see. Experts follow the demand.',
  },
}

export default function AMARequestPage() {
  return <RequestBoardClient />
}
