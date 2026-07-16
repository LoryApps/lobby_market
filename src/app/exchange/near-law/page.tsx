import type { Metadata } from 'next'
import { NearLawClient } from './NearLawClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Near-Law Radar · Lobby Exchange',
  description:
    'Civic prediction markets approaching the 67¢ supermajority threshold — topics on the verge of becoming law. Find where your vote has the highest leverage.',
  robots: { index: false },
  openGraph: {
    title: 'Near-Law Radar · Lobby Exchange',
    description:
      'Every civic market close to crossing the supermajority threshold. Imminent, close, and approaching — ranked by distance from law.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Near-Law Radar · Lobby Exchange',
    description: 'Markets within 12¢ of law — see which debates are about to become civic consensus.',
  },
}

export default function NearLawPage() {
  return <NearLawClient />
}
