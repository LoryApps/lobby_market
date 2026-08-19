import type { Metadata } from 'next'
import { RetrospectiveClient } from './RetrospectiveClient'

export const metadata: Metadata = {
  title: 'Civic Retrospective · Lobby Market',
  description:
    'Your personal civic look-back — laws you predicted, arguments that landed, streaks you ran, and your growth as a civic voice.',
  openGraph: {
    title: 'Civic Retrospective · Lobby Market',
    description:
      'See your civic journey over the past 30, 90, or 365 days — laws, arguments, accuracy, and milestones.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Retrospective · Lobby Market',
    description:
      'See your civic journey over the past 30, 90, or 365 days — laws, arguments, accuracy, and milestones.',
  },
}

export default function RetrospectivePage() {
  return <RetrospectiveClient />
}
