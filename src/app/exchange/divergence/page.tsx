import type { Metadata } from 'next'
import { DivergenceClient } from './DivergenceClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Divergence Detector · Lobby Exchange',
  description:
    'Find civic markets where the consensus price diverges from argument quality — where votes say one thing but the best arguments say another.',
  robots: { index: false },
  openGraph: {
    title: 'Divergence Detector · Lobby Exchange',
    description:
      'Spot mispriced civic markets — where voting consensus diverges from the weight of the best arguments on each side.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Divergence Detector · Lobby Exchange',
    description:
      'Markets where price and argument quality disagree — the civic exchange\'s contrarian signal.',
  },
}

export default function DivergencePage() {
  return <DivergenceClient />
}
