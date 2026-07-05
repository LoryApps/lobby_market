import type { Metadata } from 'next'
import { GymClient } from './GymClient'

export const metadata: Metadata = {
  title: 'The Argument Gym · Lobby Market',
  description:
    'Three daily exercises to sharpen your civic argumentation skills — Steelman Challenge, Rebuttal Room, and Cold Case. Complete all three to earn Clout.',
  openGraph: {
    title: 'The Argument Gym · Lobby Market',
    description:
      'Train your argumentation skills daily — steelman the underdog position, counter the top argument, and revive a cold debate.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'The Argument Gym · Lobby Market',
    description:
      'Three daily argumentation challenges. Sharpen your civic debate skills and earn Clout.',
  },
}

export default function GymPage() {
  return <GymClient />
}
