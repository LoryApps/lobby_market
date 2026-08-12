import type { Metadata } from 'next'
import { StancesClient } from './StancesClient'

export const metadata: Metadata = {
  title: 'Civic Stances · Lobby Market',
  description:
    'A macro view of democratic consensus across all topics — see how the Lobby leans by category, which debates are polarized, and where strong civic mandates have emerged.',
  openGraph: {
    title: 'Civic Stances · Lobby Market',
    description:
      'Platform-wide civic consensus at a glance — category breakdowns, polarized debates, and unanimous mandates.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Civic Stances · Lobby Market',
    description:
      'See where the platform stands — consensus by category, most polarized topics, and strongest civic mandates.',
  },
}

export default function StancesPage() {
  return <StancesClient />
}
