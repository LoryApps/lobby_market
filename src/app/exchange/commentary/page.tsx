import type { Metadata } from 'next'
import { CommentaryClient } from './CommentaryClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Market Commentary · Lobby Exchange',
  description:
    'Real-time micro-notes from traders on civic prediction markets. Share your hot take in ≤280 characters.',
  robots: { index: false },
  openGraph: {
    title: 'Market Commentary · Lobby Exchange',
    description:
      'Live trader commentary on civic consensus markets. Short-form takes from the crowd.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Market Commentary · Lobby Exchange',
    description: 'Real-time trader notes on civic prediction markets.',
  },
}

export default function CommentaryPage() {
  return <CommentaryClient />
}
