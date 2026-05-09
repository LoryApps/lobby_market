import type { Metadata } from 'next'
import { RecallClient } from './RecallClient'

export const metadata: Metadata = {
  title: 'Civic Recall · Lobby Market',
  description:
    'Memorise 6 civic topics in 15 seconds — then pick them out from a field of 12. A daily flash-memory challenge for civic minds.',
  openGraph: {
    title: 'Civic Recall · Lobby Market',
    description:
      'Six civic debates flash before you. Commit them to memory. Then find them in the crowd. Can you recall them all?',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Recall · Lobby Market',
    description: 'Daily civic flash-memory challenge. Study 6 topics — then find them in 12.',
  },
}

export default function CivicRecallPage() {
  return <RecallClient />
}
