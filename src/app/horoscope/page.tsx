import type { Metadata } from 'next'
import { HoroscopeClient } from './HoroscopeClient'

export const metadata: Metadata = {
  title: 'Civic Horoscope · Lobby Market',
  description:
    'Your daily personalised civic reading — discover which debates are written in your stars, your celestial archetype energy, and today\'s prophecy for your political soul.',
  openGraph: {
    title: 'Civic Horoscope · Lobby Market',
    description:
      'What does the civic cosmos have in store for you today? Your archetype-based daily reading, aligned topics, and celestial compatibilities.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Horoscope · Lobby Market',
    description:
      'Your daily civic reading — aligned topics, category energy, and archetype prophecy. What do the stars say about your politics today?',
  },
}

export default function HoroscopePage() {
  return <HoroscopeClient />
}
