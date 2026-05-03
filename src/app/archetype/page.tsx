import type { Metadata } from 'next'
import { ArchetypeClient } from './ArchetypeClient'

export const metadata: Metadata = {
  title: 'Civic Archetype · Lobby Market',
  description:
    'Discover your civic archetype — the political personality that shapes how you engage with governance, debate, and democracy. 10 questions, 8 archetypes.',
  openGraph: {
    title: 'What\'s Your Civic Archetype? · Lobby Market',
    description:
      'Are you a Pragmatist, Idealist, Guardian, or Reformer? Take the 10-question civic personality quiz and find out.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Archetype Quiz · Lobby Market',
    description:
      'Discover your political personality in 10 questions. 8 civic archetypes — which one are you?',
  },
}

export default function ArchetypePage() {
  return <ArchetypeClient />
}
