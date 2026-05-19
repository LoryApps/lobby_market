import type { Metadata } from 'next'
import { InheritanceClient } from './InheritanceClient'

export const metadata: Metadata = {
  title: 'Civic Inheritance · Lobby Market',
  description:
    'See how established laws generate new debates — the legislative genealogy of the Lobby. Which laws have been most generative, spawning chains of follow-on questions?',
  openGraph: {
    title: 'Civic Inheritance · Lobby Market',
    description:
      'Laws don\'t exist in isolation. When the Lobby establishes a law, it sparks new debates in the same space. Explore the living genealogy of civic consensus.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Inheritance · Lobby Market',
    description: 'How laws beget new debates — and new laws. The living genealogy of Lobby consensus.',
  },
}

export default function InheritancePage() {
  return <InheritanceClient />
}
