import type { Metadata } from 'next'
import { WrapClient } from './WrapClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Daily Wrap · Lobby Exchange',
  description:
    "Today's civic market wrap — sentiment overview, top movers, category performance, and notable events across the Lobby Exchange.",
  robots: { index: false },
  openGraph: {
    title: 'Daily Market Wrap · Lobby Exchange',
    description:
      "Your daily digest of the civic exchange — gainers, losers, category momentum, and the day's headline event.",
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Exchange Daily Wrap · Lobby Market',
    description: "Today's civic market performance at a glance.",
  },
}

export default function WrapPage() {
  return <WrapClient />
}
