import type { Metadata } from 'next'
import { DeadlockClient } from './DeadlockClient'

export const metadata: Metadata = {
  title: 'Civic Deadlock · Lobby Market',
  description:
    'The debates democracy can\'t resolve. Topics locked in near-perfect 50/50 disagreement for days — where no side can gain the upper hand despite hundreds of votes.',
  openGraph: {
    title: 'Civic Deadlock · Lobby Market',
    description:
      'These are the hardest questions the Lobby has faced — debates stuck at 50/50 for days, where consensus refuses to form.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Deadlock · Lobby Market',
    description: 'Democracy\'s hardest questions — debates the Lobby can\'t resolve, locked in perfect disagreement.',
  },
}

export default function DeadlockPage() {
  return <DeadlockClient />
}
