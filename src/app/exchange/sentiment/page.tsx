import type { Metadata } from 'next'
import { SentimentClient } from './SentimentClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Market Sentiment Gauge · Lobby Exchange',
  description:
    'Real-time civic market sentiment — track bullish/bearish breadth, sector-by-sector consensus, and the biggest movers across all active prediction markets.',
  openGraph: {
    title: 'Market Sentiment Gauge · Lobby Exchange',
    description:
      'A live sentiment dashboard for every civic prediction market — overall score, sector breakdown, movers, and distribution across all active debates.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Market Sentiment Gauge · Lobby Exchange',
    description:
      'Live civic market sentiment: bullish/bearish breadth, sector analysis, and top movers in one view.',
  },
}

export default function SentimentPage() {
  return <SentimentClient />
}
