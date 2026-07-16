import type { Metadata } from 'next'
import { TradesClient } from './TradesClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Live Trades · Lobby Exchange',
  description:
    'Real-time activity feed of civic market positions — watch votes flow across every active debate as citizens stake their convictions.',
  robots: { index: false },
  openGraph: {
    title: 'Live Trades · Lobby Exchange',
    description:
      'The civic trading tape. See every position taken across all active markets in real time — who is buying conviction and who is shorting consensus.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Live Trades · Lobby Exchange',
    description:
      'Watch the civic trading tape in real time — every vote across every active market.',
  },
}

export default function TradesPage() {
  return <TradesClient />
}
