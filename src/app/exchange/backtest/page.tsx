import type { Metadata } from 'next'
import { BacktestClient } from './BacktestClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Strategy Backtester · Lobby Exchange',
  description:
    'Simulate any prediction market strategy against every resolved civic debate. Test FOR, AGAINST, Momentum, or Contrarian approaches with custom price and category filters — and see exactly what your P&L would have been.',
  robots: { index: false },
  openGraph: {
    title: 'Strategy Backtester · Lobby Exchange',
    description:
      'Test civic prediction market strategies against all resolved topics. See win rate, P&L curve, drawdown, and category breakdown — all simulated from real market history.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Strategy Backtester · Lobby Exchange',
    description: 'Backtest any strategy on the civic prediction market. Win rate, P&L chart, drawdown — all from real history.',
  },
}

export default function BacktestPage() {
  return <BacktestClient />
}
