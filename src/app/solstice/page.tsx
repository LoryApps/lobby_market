import type { Metadata } from 'next'
import { SolsticeClient } from './SolsticeClient'

export const metadata: Metadata = {
  title: 'Civic Solstice · Lobby Market',
  description:
    'The platform\'s annual rhythm at a glance — 52 weeks of civic engagement, peak and quiet periods, seasonal category dominance, and the moments democracy burned brightest.',
  openGraph: {
    title: 'Civic Solstice · Lobby Market',
    description:
      'A year of democratic activity in one view. See when the platform peaks, which seasons are most active, and the categories that dominate each quarter.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Solstice · Lobby Market',
    description:
      '52 weeks of civic activity — peaks, quiet spells, and the seasonal rhythm of democracy on Lobby Market.',
  },
}

export default function SolsticePage() {
  return <SolsticeClient />
}
