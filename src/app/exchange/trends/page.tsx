import type { Metadata } from 'next'
import { TrendsClient } from './TrendsClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Market Trends · Lobby Exchange',
  description:
    'Historical price trend analysis for all civic prediction markets — spot breakouts, reversals, consolidations, and momentum shifts before they peak.',
  robots: { index: false },
  openGraph: {
    title: 'Market Trends · Lobby Exchange',
    description:
      'Track the shape of market movement over time — rising, falling, breakouts, and consolidation patterns across every active civic debate.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Market Trends · Lobby Exchange',
    description: 'Spot emerging patterns in civic markets before they peak.',
  },
}

export default function TrendsPage() {
  return <TrendsClient />
}
