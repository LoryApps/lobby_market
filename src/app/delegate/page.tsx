import type { Metadata } from 'next'
import { DelegateClient } from './DelegateClient'

export const metadata: Metadata = {
  title: 'Vote Delegation · Lobby Market',
  description:
    'Liquid democracy for the Lobby. Delegate your voting power on specific topics or entire categories to trusted citizens whose judgment you respect.',
  openGraph: {
    title: 'Vote Delegation · Lobby Market',
    description:
      'Empower trusted citizens to guide your civic votes. Delegate by topic or category — revoke any time. Your explicit vote always wins.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Vote Delegation · Lobby Market',
    description:
      'Liquid democracy: delegate your vote to someone you trust, by topic or category. Revoke any time.',
  },
}

export default function DelegatePage() {
  return <DelegateClient />
}
