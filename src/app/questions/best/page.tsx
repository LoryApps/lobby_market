import type { Metadata } from 'next'
import { BestAnswersClient } from './BestAnswersClient'

export const metadata: Metadata = {
  title: 'Best Answers · Lobby Market',
  description:
    'The highest-quality Q&A pairs on the platform — community questions with accepted answers, ranked by upvotes and helpfulness across every civic debate.',
  openGraph: {
    title: 'Best Answers · Lobby Market',
    description:
      'Browse the best answered civic questions — every topic, every category. The knowledge layer of the Lobby.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Best Answers · Lobby Market',
    description: 'Curated best Q&A pairs from every civic debate — helpful, verified, and upvoted by the community.',
  },
}

export default function BestAnswersPage() {
  return <BestAnswersClient />
}
