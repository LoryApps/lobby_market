import type { Metadata } from 'next'
import { HeatmapClient } from './HeatmapClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Market Heat Map · Lobby Exchange',
  description:
    'Visual heat map of all civic prediction markets — sized by volume, colored by consensus direction. See which categories are heating up and which are cooling down at a glance.',
  robots: { index: false },
  openGraph: {
    title: 'Market Heat Map · Lobby Exchange',
    description:
      'Every civic debate as a heat map tile — see the full market landscape at once. Blue means consensus, red means resistance, gold means near-law.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Market Heat Map · Lobby Exchange',
    description: 'Civic market heat map — all debates in one visual grid, colored by consensus strength.',
  },
}

export default function HeatmapPage() {
  return <HeatmapClient />
}
