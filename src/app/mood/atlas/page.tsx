import type { Metadata } from 'next'
import { MoodAtlasClient } from './MoodAtlasClient'

export const metadata: Metadata = {
  title: 'Mood Atlas · Lobby Market',
  description:
    'The emotional fingerprint of every civic category — see whether Technology debates make the Lobby worried, or if Economics sparks hope. A category-by-category breakdown of how civic issues feel.',
  openGraph: {
    title: 'Mood Atlas · Lobby Market',
    description:
      'Does Technology make us worried? Does Politics inspire or frustrate? The Lobby\'s emotional profile broken down by civic category.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Mood Atlas · Lobby Market',
    description:
      'How does each civic category make the Lobby feel? Hopeful, worried, inspired — the emotional atlas of debate.',
  },
}

export default function MoodAtlasPage() {
  return <MoodAtlasClient />
}
