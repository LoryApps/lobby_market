import type { Metadata } from 'next'
import { ShiftingClient } from './ShiftingClient'

export const metadata: Metadata = {
  title: 'Shifting Tides · Lobby Market',
  description:
    'Topics where opinion is actively moving right now — debates surging FOR or AGAINST in the last 24 hours. Watch the Lobby change its mind in real time.',
  openGraph: {
    title: 'Shifting Tides · Lobby Market',
    description:
      'Which debates are moving right now? See topics surging FOR and surging AGAINST in the last 24 hours — opinion in motion.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Shifting Tides · Lobby Market',
    description:
      'Real-time opinion momentum: topics surging FOR vs AGAINST in the last 24 hours.',
  },
}

export default function ShiftingPage() {
  return <ShiftingClient />
}
