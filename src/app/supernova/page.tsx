import type { Metadata } from 'next'
import SupernovaClient from './SupernovaClient'

export const metadata: Metadata = {
  title: 'Civic Supernova · Lobby Market',
  description:
    'Debates that burned with explosive initial vote velocity but have since gone dark. The Supernova Ratio measures how much hotter a topic burned at launch versus today — ranked by magnitude.',
  openGraph: {
    title: 'Civic Supernova · Lobby Market',
    description:
      'Which civic debates exploded onto the platform then faded into silence? Ranked by peak-to-current vote ratio — the brightest burns, now cooling.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Supernova · Lobby Market',
    description:
      'Topics that burned brightest at launch, now cooling. Supernova ratio = lifetime avg votes/day ÷ current rate.',
  },
}

export default function SupernovaPage() {
  return <SupernovaClient />
}
