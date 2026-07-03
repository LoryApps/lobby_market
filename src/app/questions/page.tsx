import type { Metadata } from 'next'
import { QuestionsHubClient } from './QuestionsHubClient'

export const metadata: Metadata = {
  title: 'Community Q&A · Lobby Market',
  description:
    'Browse open questions from every civic debate — answer what you know, upvote what you want answered, and help the community reach clearer understanding.',
  openGraph: {
    title: 'Community Q&A · Lobby Market',
    description:
      'Open questions from every debate on the platform. Answer what you know — help the Lobby understand.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Community Q&A · Lobby Market',
    description: 'Cross-topic Q&A hub — unanswered questions from every civic debate, waiting for you.',
  },
}

export default function QuestionsHubPage() {
  return <QuestionsHubClient />
}
