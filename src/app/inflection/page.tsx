import type { Metadata } from 'next'
import { InflectionClient } from './InflectionClient'

export const metadata: Metadata = {
  title: 'Civic Inflection Points · Lobby Market',
  description:
    'Track where civic debates are about to transform — topics approaching or straddling the 50%, 60%, 67%, and 75% consensus thresholds that change their political meaning.',
  openGraph: {
    title: 'Civic Inflection Points · Lobby Market',
    description:
      'Every debate has a turning point. Track which topics are within striking distance of a consensus threshold — and which ones just crossed one.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Inflection Points · Lobby Market',
    description:
      'Which civic debates are about to tip? Track the 50%, 60%, 67%, and 75% consensus thresholds.',
  },
}

export default function InflectionPage() {
  return <InflectionClient />
}
