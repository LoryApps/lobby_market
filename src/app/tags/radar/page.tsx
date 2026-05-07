import type { Metadata } from 'next'
import { RadarClient } from './RadarClient'

export const metadata: Metadata = {
  title: 'Tag Radar · Lobby Market',
  description:
    'A 6-dimension spider chart comparing your followed tags across scale, governance, activity, engagement, freshness, and polarisation. Understand your civic interests at a glance.',
  openGraph: {
    title: 'Tag Radar · Lobby Market',
    description:
      'Visual engagement map of your followed civic tags — see which are growing, governing, and driving debate.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Tag Radar · Lobby Market',
    description: 'Compare your civic interests across 6 engagement dimensions.',
  },
}

export default function TagRadarPage() {
  return <RadarClient />
}
