import type { Metadata } from 'next'
import { IndicesClient } from './IndicesClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Civic Indices · Lobby Exchange',
  description:
    'Curated civic market indices — track thematic policy consensus across Economic, Political, Green, Digital, and Health debates in a single view.',
  robots: { index: false },
  openGraph: {
    title: 'Civic Indices · Lobby Exchange',
    description:
      'Volume-weighted composite indices for every major civic policy domain. See where the consensus is building and where it\'s contested.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Indices · Lobby Exchange',
    description: 'Track curated civic market indices — policy consensus baskets across 9 thematic areas.',
  },
}

export default function IndicesPage() {
  return <IndicesClient />
}
