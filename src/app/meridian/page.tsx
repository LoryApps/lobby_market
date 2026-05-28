import type { Metadata } from 'next'
import { MeridianClient } from './MeridianClient'

export const metadata: Metadata = {
  title: 'The Civic Meridian · Lobby Market',
  description:
    'The great unresolved questions of civic society — debates with the highest engagement that still refuse to tip either way. Ranked by Meridian Score: engagement multiplied by contestedness.',
  openGraph: {
    title: 'The Civic Meridian · Lobby Market',
    description:
      'Which debates refuse to resolve — and matter most? The Meridian surfaces the issues with the most votes, arguments, and debates that remain locked at 50/50.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'The Civic Meridian · Lobby Market',
    description:
      'Society\'s great unresolved questions: the most engaged topics that still can\'t tip either way.',
  },
}

export default function MeridianPage() {
  return <MeridianClient />
}
