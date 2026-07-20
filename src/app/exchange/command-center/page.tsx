import type { Metadata } from 'next'
import { CommandCenterClient } from './CommandCenterClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Command Center · Lobby Exchange',
  description:
    'Your personal civic exchange dashboard — watchlist prices, active alerts, price forecasts, and portfolio positions in one place.',
  robots: { index: false },
  openGraph: {
    title: 'Command Center · Lobby Exchange',
    description:
      'Unified personal dashboard for your civic prediction market activity — watchlist, alerts, forecasts, and portfolio at a glance.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Command Center · Lobby Exchange',
    description: 'Your personal civic market dashboard — watchlist, alerts, forecasts, and positions.',
  },
}

export default function CommandCenterPage() {
  return <CommandCenterClient />
}
