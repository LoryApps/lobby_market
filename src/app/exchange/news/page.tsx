import type { Metadata } from 'next'
import { NewsClient } from './NewsClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Market News · Lobby Exchange',
  description:
    'Real-time market news for the Civic Exchange — price crossings, status transitions, closing alerts, and deadlock warnings across all civic prediction markets.',
  robots: { index: false },
  openGraph: {
    title: 'Market News · Lobby Exchange',
    description:
      'Live feed of civic market events: laws established, markets entering voting, price milestones, and closing alerts.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Market News · Lobby Exchange',
    description: 'Real-time civic market events — price crossings, status changes, and closing alerts.',
  },
}

export default function NewsPage() {
  return <NewsClient />
}
