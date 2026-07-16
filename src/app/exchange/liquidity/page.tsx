import type { Metadata } from 'next'
import { LiquidityClient } from './LiquidityClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Market Liquidity · Lobby Exchange',
  description:
    'Analyse the depth of every civic prediction market — discover thin markets susceptible to consensus shift, the most liquid debates, and the swing zone where a few votes could change everything.',
  robots: { index: false },
  openGraph: {
    title: 'Market Liquidity · Lobby Exchange',
    description:
      'Depth analysis across all active civic markets — thin, liquid, and swing-zone markets ranked by consensus stability.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Market Liquidity · Lobby Exchange',
    description:
      'Which civic markets can be swung with a single vote? Find thin markets, liquid consensus, and the swing zone.',
  },
}

export default function LiquidityPage() {
  return <LiquidityClient />
}
