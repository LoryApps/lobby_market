import type { Metadata } from 'next'
import { RelayCategoriesClient } from './RelayCategoriesClient'

export const metadata: Metadata = {
  title: 'Relay Categories · Lobby Market',
  description:
    'Browse civic relay chains by category — find collaborative argument chains on Economics, Politics, Technology, Science, and more.',
  openGraph: {
    title: 'Relay Categories · Lobby Market',
    description:
      'Discover the best FOR and AGAINST relay chains in every civic category. Join an open chain or vote on a completed one.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Relay Categories · Lobby Market',
    description: 'Browse civic relay chains by topic category.',
  },
}

export default function RelayCategoriesPage() {
  return <RelayCategoriesClient />
}
