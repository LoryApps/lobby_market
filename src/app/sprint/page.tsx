import type { Metadata } from 'next'
import { SprintClient } from './SprintClient'

export const metadata: Metadata = {
  title: 'Civic Sprint · Lobby Market',
  description:
    'A 10-round prediction game — read closed topics and guess whether the Lobby voted them into law or they failed. Race the clock for speed bonuses.',
  openGraph: {
    title: 'Civic Sprint · Lobby Market',
    description:
      'Can you predict which debates became law and which ones failed? 10 rounds, 15 seconds each. Speed bonuses for quick calls.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Sprint · Lobby Market',
    description: 'Predict law vs. fail on 10 closed civic debates. Speed matters — faster = more points.',
  },
}

export default function SprintPage() {
  return <SprintClient />
}
