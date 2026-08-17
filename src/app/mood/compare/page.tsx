import type { Metadata } from 'next'
import { MoodCompareClient } from './MoodCompareClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Mood Compare · Lobby Market',
  description:
    'Compare how two civic topics make the community feel — side-by-side emotional profiles, divergence scores, and shared sentiment.',
  openGraph: {
    title: 'Civic Mood Compare · Lobby Market',
    description:
      'Pick two debates and see how the community emotionally responds to each. Where do they diverge? Where do they align? The emotional contrast, revealed.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Mood Compare · Lobby Market',
    description:
      'How differently does the Lobby feel about two debates? Side-by-side emotional profiles.',
  },
}

export default function MoodComparePage() {
  return <MoodCompareClient />
}
