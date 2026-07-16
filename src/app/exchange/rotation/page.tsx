import type { Metadata } from 'next'
import { RotationClient } from './RotationClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Sector Rotation · Lobby Exchange',
  description:
    'Track which civic debate categories are leading, recovering, weakening, or lagging — based on 7-day consensus momentum across all active markets.',
  openGraph: {
    title: 'Sector Rotation · Lobby Exchange',
    description:
      'The civic market rotation matrix — which categories are gaining momentum and which are fading. Spot emerging trends before they peak.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Sector Rotation · Lobby Exchange',
    description: 'Leading, weakening, recovering, and lagging civic debate sectors — 7-day momentum view.',
  },
}

export default function RotationPage() {
  return <RotationClient />
}
