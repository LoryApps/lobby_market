import type { Metadata } from 'next'
import { LeadersClient } from './LeadersClient'

export const metadata: Metadata = {
  title: 'Knowledge Leaders · Lobby Market Q&A',
  description:
    'The citizens who keep the Lobby informed — top question-askers by upvotes, top answerers by accepted answers, and the burning questions still waiting for a solution.',
  openGraph: {
    title: 'Knowledge Leaders · Lobby Market Q&A',
    description:
      'Top question-askers, best answerers, and the hardest open questions in the Lobby.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Knowledge Leaders · Lobby Market Q&A',
    description: 'Who asks the sharpest questions? Who gives the best answers? Find out here.',
  },
}

export default function QALeadersPage() {
  return <LeadersClient />
}
