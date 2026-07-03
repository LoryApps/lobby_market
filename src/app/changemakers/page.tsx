import type { Metadata } from 'next'
import { ChangemakersClient } from './ChangemakersClient'

export const metadata: Metadata = {
  title: 'Persuasion Hub · Lobby Market',
  description: "What would change your mind? Explore the platform's most open-minded citizens and the topics most open to genuine persuasion.",
  openGraph: {
    title: 'Persuasion Hub · Lobby Market',
    description: "Platform-wide view of What Would Change My Mind? statements — the civic community's honest persuasion conditions.",
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Persuasion Hub · Lobby Market',
    description: 'What evidence or argument would flip your position? See the community\'s honest answers.',
  },
}

export default function ChangemakersPage() {
  return <ChangemakersClient />
}
