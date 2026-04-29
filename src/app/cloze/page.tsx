import type { Metadata } from 'next'
import { ClozeClient } from './ClozeClient'

export const metadata: Metadata = {
  title: 'Civic Cloze · Lobby Market',
  description:
    'Fill in the missing word from real Lobby Market laws and debate statements. A daily challenge testing your civic vocabulary.',
  openGraph: {
    title: 'Civic Cloze · Lobby Market',
    description:
      'Can you complete the law? Fill in the missing word from real civic debates and established laws.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Cloze · Lobby Market',
    description: 'Daily fill-in-the-blank challenge using real laws and civic debates.',
  },
}

export default function ClozePage() {
  return <ClozeClient />
}
