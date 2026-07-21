import type { Metadata } from 'next'
import { JournalClient } from './JournalClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Trade Journal · Lobby Exchange',
  description:
    'Your personal civic prediction market journal — annotate your positions with thesis notes, track your reasoning, and reflect on settled decisions.',
  robots: { index: false },
  openGraph: {
    title: 'Trade Journal · Lobby Exchange',
    description:
      'Log your thesis for every position, track your reasoning, and review what you got right and wrong across your civic prediction portfolio.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Trade Journal · Lobby Exchange',
    description: 'Annotate your positions, log your thesis, and learn from every civic market decision.',
  },
}

export default function JournalPage() {
  return <JournalClient />
}
