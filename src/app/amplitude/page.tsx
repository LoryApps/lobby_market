import type { Metadata } from 'next'
import { AmplitudeClient } from './AmplitudeClient'

export const metadata: Metadata = {
  title: 'Civic Amplitude Index · Lobby Market',
  description:
    'Measure the decisive force of community opinion — which topics have reached overwhelming consensus, and which remain in contested territory.',
  openGraph: {
    title: 'Civic Amplitude Index · Lobby Market',
    description:
      'See which civic debates have reached decisive verdicts and which are still in deadlock. Amplitude = how far the community has swung — and how many votes back it up.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Amplitude Index · Lobby Market',
    description:
      'Which civic debates have reached peak consensus — and which are locked in deadlock? The Civic Amplitude Index.',
  },
}

export default function AmplitudePage() {
  return <AmplitudeClient />
}
