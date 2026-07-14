import type { Metadata } from 'next'
import { UrgentQuestionsClient } from './UrgentQuestionsClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Urgent Questions · Lobby Market',
  description:
    'Table an Urgent Question demanding an immediate answer from a minister or coalition leader. When the matter is pressing and the public interest demands a response, raise it here.',
  openGraph: {
    title: 'Urgent Questions · Lobby Market',
    description:
      'Westminster-style urgent questions: citizens demand immediate answers from ministers. Second the questions you think are most urgent.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Urgent Questions · Lobby Market',
    description: 'Demand immediate answers from civic ministers. Table or second an urgent question today.',
  },
}

export default function UrgentQuestionsPage() {
  return <UrgentQuestionsClient />
}
