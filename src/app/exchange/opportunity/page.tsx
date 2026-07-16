import type { Metadata } from 'next'
import { OpportunityClient } from './OpportunityClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Market Opportunity · Lobby Exchange',
  description:
    'Discover where your vote and voice will have the greatest civic impact — contested debates in your categories, tipping-point markets, closing soon, and more.',
  robots: { index: false },
  openGraph: {
    title: 'Market Opportunity · Lobby Exchange',
    description:
      'Personalised civic market intelligence — find where you can move the needle on debates that matter.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Market Opportunity · Lobby Exchange',
    description: 'Where your vote matters most right now. Personalised exchange opportunities.',
  },
}

export default function OpportunityPage() {
  return <OpportunityClient />
}
