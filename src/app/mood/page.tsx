import type { Metadata } from 'next'
import { MoodClient } from './MoodClient'

export const metadata: Metadata = {
  title: 'Civic Mood · Lobby Market',
  description:
    'The emotional temperature of civic debate. See how the Lobby is feeling right now — hopeful, inspired, worried, determined — and which debates spark each emotion.',
  openGraph: {
    title: 'Civic Mood · Lobby Market',
    description:
      'Democracy\'s emotional pulse. Platform-wide mood tracking across every civic debate — which topics make people hopeful, which leave them worried.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Mood · Lobby Market',
    description:
      'How does civic debate make the Lobby feel? Hopeful, inspired, worried, determined — the platform\'s emotional landscape in real time.',
  },
}

export default function MoodPage() {
  return <MoodClient />
}
