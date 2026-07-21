import type { Metadata } from 'next'
import { ConflictsClient } from './ConflictsClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Market Conflicts · Lobby Exchange',
  description:
    'Spot logically contradictory market pairs — where both markets are priced above 50% despite historically moving in opposite directions. Find the mispricing before resolution.',
  robots: { index: false },
  openGraph: {
    title: 'Market Conflicts · Lobby Exchange',
    description:
      'Two markets, both leaning YES — but they can\'t both be right. Find contradictory civic prediction markets before they correct.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Market Conflicts · Lobby Exchange',
    description: 'Logically contradictory market pairs where the collective pricing is internally inconsistent.',
  },
}

export default function ConflictsPage() {
  return <ConflictsClient />
}
