import type { Metadata } from 'next'
import { CivicCompassClient } from './CivicCompassClient'

export const metadata: Metadata = {
  title: 'Civic Compass · Lobby Market',
  description:
    'Your voting fingerprint across 8 policy domains — politics, economics, technology, ethics, science, culture, philosophy, and health.',
  openGraph: {
    title: 'Civic Compass · Lobby Market',
    description:
      'Where do you stand? Your Civic Compass maps every vote you have cast into an 8-axis political radar — revealing your civic archetype and dominant policy domain.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Civic Compass · Lobby Market',
    description:
      'Your 8-axis political radar — discover your civic archetype from your voting record.',
  },
}

export default function CivicCompassPage() {
  return <CivicCompassClient />
}
