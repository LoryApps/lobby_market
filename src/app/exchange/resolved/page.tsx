import type { Metadata } from 'next'
import { ResolvedClient } from './ResolvedClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Resolved Markets · Lobby Exchange',
  description:
    'A complete history of every settled civic prediction market — see which topics became law, which failed, and how accurate the crowd was.',
  robots: { index: true },
  openGraph: {
    title: 'Resolved Markets · Lobby Exchange',
    description:
      'Browse every settled market on Lobby Exchange. See final outcomes, crowd accuracy, and conviction scores — the permanent record of civic prediction.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Resolved Markets · Lobby Exchange',
    description:
      'Every civic prediction that has been settled — enacted laws, failed motions, and crowd accuracy.',
  },
}

export default function ResolvedPage() {
  return <ResolvedClient />
}
