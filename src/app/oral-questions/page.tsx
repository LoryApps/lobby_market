import { Metadata } from 'next'
import OralQuestionsClient from './OralQuestionsClient'

export const metadata: Metadata = {
  title: 'Oral Questions | Lobby Market',
  description: 'Submit and upvote questions to the department facing the chamber this week. A rotating Westminster-style departmental questions system.',
  openGraph: {
    title: 'Oral Questions | Lobby Market',
    description: 'Submit and upvote questions to the department facing the chamber this week.',
    type: 'website',
  },
}

export default function OralQuestionsPage() {
  return <OralQuestionsClient />
}
