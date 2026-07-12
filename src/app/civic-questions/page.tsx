import type { Metadata } from 'next'
import { CivicQuestionsClient } from './CivicQuestionsClient'

export const metadata: Metadata = {
  title: 'Questions Time · Lobby Market',
  description:
    'Hold Shadow Cabinet ministers accountable. Submit formal questions on their voting record, category leadership, and policy positions — Westminster-style.',
  openGraph: {
    title: 'Questions Time · Lobby Market',
    description:
      'A democratic accountability system where citizens formally question Shadow Cabinet ministers on their stances and voting patterns.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Questions Time · Lobby Market',
    description: 'Hold civic ministers accountable — Westminster-style questions and answers.',
  },
}

export default function CivicQuestionsPage() {
  return <CivicQuestionsClient />
}
