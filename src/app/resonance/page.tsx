import type { Metadata } from 'next'
import { ResonanceClient } from './ResonanceClient'

export const metadata: Metadata = {
  title: 'Civic Resonance · Lobby Market',
  description:
    'See which of your arguments crossed partisan lines — earning upvotes from users who voted the opposite side. Discover your cross-aisle impact and resonance archetype.',
  openGraph: {
    title: 'Civic Resonance · Lobby Market',
    description:
      'Which of your arguments resonated with the other side? Track your cross-partisan upvotes, resonance archetype, and the opponents who respect your reasoning.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Resonance · Lobby Market',
    description:
      'The arguments that crossed the divide — see your cross-partisan upvotes and find out if you\'re a Bridge Builder or a Choir Preacher.',
  },
}

export default function ResonancePage() {
  return <ResonanceClient />
}
