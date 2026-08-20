import type { Metadata } from 'next'
import { OverdueThesesClient } from './OverdueThesesClient'

export const metadata: Metadata = {
  title: 'Overdue Theses · Lobby Market',
  description:
    'Civic theses that have passed their resolution date without a verdict — accountability in action.',
  openGraph: {
    title: 'Overdue Theses · Lobby Market',
    description: 'Civic theses awaiting a verdict past their deadline.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Overdue Theses · Lobby Market',
    description: 'These civic predictions are past due — hold authors accountable.',
  },
}

export default function OverdueThesesPage() {
  return <OverdueThesesClient />
}
