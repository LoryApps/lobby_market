import type { Metadata } from 'next'
import { FlowClient } from './FlowClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Market Flow · Lobby Exchange',
  description:
    'Live consensus flow across all civic prediction markets — see which categories are rising or falling, and track the most active markets in real time.',
  robots: { index: false },
  openGraph: {
    title: 'Market Flow · Lobby Exchange',
    description:
      'Real-time sentiment direction across all civic market categories. Which policy debates are moving — and in what direction.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Market Flow · Lobby Exchange',
    description: 'Live consensus flow — see which civic debates are moving and where the conviction is.',
  },
}

export default function FlowPage() {
  return <FlowClient />
}
