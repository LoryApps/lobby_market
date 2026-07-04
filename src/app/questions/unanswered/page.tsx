import type { Metadata } from 'next'
import { UnansweredClient } from './UnansweredClient'

export const metadata: Metadata = {
  title: 'Unanswered Questions · Lobby Market',
  description:
    'Browse the queue of open questions waiting for expert answers. Share your knowledge — every answer helps the community reach clearer understanding on civic debates.',
  openGraph: {
    title: 'Unanswered Questions · Lobby Market',
    description:
      'Open questions from every civic debate, waiting for someone who knows. Pick a question and share your expertise.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Unanswered Questions · Lobby Market',
    description: 'Answer queue — open civic questions waiting for your expertise.',
  },
}

export default function UnansweredQuestionsPage() {
  return <UnansweredClient />
}
