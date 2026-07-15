import type { Metadata } from 'next'
import { CategoriesClient } from './CategoriesClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Sectors · Lobby Exchange',
  description:
    'Browse civic prediction markets by policy sector — see average consensus, trading volume, and top movers across all 10 categories.',
  robots: { index: false },
  openGraph: {
    title: 'Sectors · Lobby Exchange',
    description:
      'Which policy domain has the strongest civic consensus? Browse all 10 sectors to see average market price, volume, and top topics.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Sectors · Lobby Exchange',
    description: 'Civic market sectors — consensus, volume, and top movers across 10 policy domains.',
  },
}

export default function SectorsPage() {
  return <CategoriesClient />
}
