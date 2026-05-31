import type { Metadata } from 'next'
import { VolatilityClient } from './VolatilityClient'

export const metadata: Metadata = {
  title: 'Civic Volatility Index · Lobby Market',
  description:
    'Which civic debates are genuinely up for grabs? The Volatility Index ranks active topics by consensus instability — high swing ranges, day-over-day reversals, and unsettled communities.',
  openGraph: {
    title: 'Civic Volatility Index · Lobby Market',
    description:
      'Ranked by standard deviation of daily FOR% over 7 days. These are the debates where no stable majority has formed — the most contested ground in civic democracy.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Volatility Index · Lobby Market',
    description: 'The most unstable debates on Lobby Market — where the community keeps changing its mind.',
  },
}

export default function VolatilityPage() {
  return <VolatilityClient />
}
