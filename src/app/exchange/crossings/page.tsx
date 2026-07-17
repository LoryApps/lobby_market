import type { Metadata } from 'next'
import { CrossingsClient } from './CrossingsClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Crossings · Lobby Exchange',
  description:
    'Track civic markets that recently crossed key consensus thresholds — approaching law at 75¢, majority flips at 50¢, and deep dissent at 25¢.',
  robots: { index: false },
  openGraph: {
    title: 'Crossings · Lobby Exchange',
    description: 'Markets that just crossed critical consensus thresholds — see which topics are approaching law, flipping majority, or entering deep dissent.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Crossings · Lobby Exchange',
    description: 'Threshold crossings in civic prediction markets — law approach, majority flips, and reversal signals.',
  },
}

export default function CrossingsPage() {
  return <CrossingsClient />
}
